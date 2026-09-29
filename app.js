/* IntuiCode — the app.
 *
 * Write mode:  blueprint (story with blanks) -> sentences in folders -> Python -> terminal
 * Read mode:   imported Python -> sections -> plain-English summaries and sentences
 */
(function () {
  'use strict';

  const LANG = window.IntuiLang.python;
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
  const LAYOUTS = { structured: ['settings', 'tools', 'main'], script: ['main'] };

  const slug = (s) => String(s).toLowerCase().replace(/\.py$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'my-program';

  function projectFromBlueprint(bp, values) {
    const filled = BP.fill(bp, values);
    const nameField = bp.fields.find(f => f.name === 'project name');
    return {
      version: 1, lang: 'python', name: slug(nameField ? (values[nameField.name] ?? nameField.value) : bp.title),
      sections: LAYOUTS[bp.layout].map(f => ({ id: f, file: f, text: filled[f] || '' })),
      active: 'main',
    };
  }

  const PROJECT_KEY = 'intuicode.project.v1';
  const PREVIOUS_KEY = 'intuicode.previous.v1';
  function loadProject() {
    const p = store.get(PROJECT_KEY, null);
    if (p && p.version === 1 && Array.isArray(p.sections) && p.sections.length) return p;
    return projectFromBlueprint(BP.parse(BP.BUILT_IN[0]), {});
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

  const activeSec = () => project.sections.find(s => s.id === project.active) || project.sections[project.sections.length - 1];

  function replaceProject(next, message) {
    activeSec().text = ta.value;
    store.set(PREVIOUS_KEY, project);
    project = next;
    runtimeMark = null;
    ta.value = activeSec().text;
    Runner.reset();
    setMode('write');
    openSection(project.active);
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
    try { compiled = LANG.compileProject(project); }
    catch (e) { console.error(e); }
  }
  const secResult = (id) => compiled && compiled.results[id];
  const caretLine = () => ta.value.slice(0, ta.selectionStart).split('\n').length - 1;

  const STARTER = /^(otherwise if|else if|otherwise|else|if|when|repeat until|repeat while|repeat forever|repeat|keep going|while|as long as|count down|count|for each|for every|for|define|give back|return|show|print|say|display|ask for an? (?:whole number|number|decimal)|ask for|ask|set|make|let|change|update|create (?:an? )?(?:empty )?(?:list|dictionary)|create|increase|decrease|multiply|divide|add|remove|subtract|sort|reverse|shuffle|wait|run|call|stop the loop|stop the program|skip to next|do nothing|use|remember|forever)(?=\s|$)/i;
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

  function renderPython() {
    const sec = activeSec();
    const r = secResult(sec.id);
    $('pyFile').textContent = sec.file + '.py';
    if (!r) { pycode.innerHTML = ''; return; }
    pycode.innerHTML = r.lines.map((o, i) => {
      const hasNote = o.note || (o.src >= 0 && r.info[o.src] && r.info[o.src].notes.length);
      return `<div class="pl${o.src < 0 ? ' hdr' : ''}${hasNote ? ' note' : ''}" data-i="${i}" data-src="${o.src}"><span class="ln">${i + 1}</span><span class="pc">${hlPy(o.text) || ' '}</span></div>`;
    }).join('');
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

  function renderExplain() {
    const sec = activeSec();
    const r = secResult(sec.id);
    const li = caretLine();
    const text = ta.value.split('\n')[li] || '';
    const box = $('explain');
    if (!r || !text.trim()) {
      box.innerHTML = `<p class="ex-guide">${withCode(LANG.GUIDE.sections[sec.file] || '')}</p>
        <div class="ex-hint"><span>Start from an idea: open <b>Blueprints</b> and fill in the blanks.</span><span><kbd>Tab</kbd> jumps to the next ‹blank›</span><span><kbd>Ctrl</kbd>+<kbd>Enter</kbd> runs the program</span><span>Put your cursor on any line to see how it becomes Python.</span></div>`;
      return;
    }
    const inf = r.info[li] || { py: [], notes: [], warns: [], errs: [] };
    const py = inf.py.map(i => r.lines[i].text).filter(t => t.trim()).join('\n');
    const items = [];
    if (runtimeMark && runtimeMark.sec === sec.id && runtimeMark.line === li) items.push(`<li class="err">${withCode(runtimeMark.msg)}</li>`);
    if (li === typingLine && inf.errs.length) items.push('<li>Keep typing, or pick a suggestion. Problems on this line show once you move to another line.</li>');
    else inf.errs.forEach(e => items.push(`<li class="err">${withCode(e)}</li>`));
    inf.warns.forEach(w => items.push(`<li class="warn">${withCode(w)}</li>`));
    inf.notes.forEach(n => items.push(`<li>${withCode(n)}</li>`));
    const pyLines = inf.py.filter(i => r.lines[i].text.trim()).map(i => i + 1);
    box.innerHTML = `<div class="ex-map">
        <div class="ex-cell"><span class="ex-lbl">You wrote · line ${li + 1}</span><div class="ex-say">${escHtml(text.trim())}</div></div>
        <div class="ex-arrow" aria-hidden="true">→</div>
        <div class="ex-cell"><span class="ex-lbl">Python · ${sec.file}.py ${pyLines.length ? 'line ' + pyLines.join(', ') : ''}</span><div class="ex-py">${hlPy(py.split('\n').map(l => l.trimStart()).join('\n'))}</div></div>
      </div>
      ${items.length ? `<ul class="ex-notes">${items.join('')}</ul>` : ''}`;
  }

  function iconSvg(path) {
    return `<svg class="ti-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="${path}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }
  const FOLDER_SVG = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1.5 4.5v8h13v-7h-7l-1.5-1.5h-4.5z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>';

  function renderTree() {
    $('treeRoot').innerHTML = `${FOLDER_SVG}${escHtml(project.name)}/`;
    $('tree').innerHTML = project.sections.map(s => {
      const meta = SECTION_META[s.file];
      const r = secResult(s.id);
      const skip = (i) => s.id === project.active && i.line === typingLine;
      const errs = r ? r.info.reduce((n, i) => n + (skip(i) ? 0 : i.errs.length), 0) : 0;
      const warns = r ? r.info.reduce((n, i) => n + (skip(i) ? 0 : i.warns.length), 0) : 0;
      const badge = errs ? `<span class="ti-badge" title="${errs} problem${errs > 1 ? 's' : ''}">${errs}</span>` : warns ? `<span class="ti-badge warn" title="${warns} warning${warns > 1 ? 's' : ''}">${warns}</span>` : '';
      return `<button type="button" class="tree-item${s.id === project.active ? ' active' : ''}" data-id="${s.id}" title="${escHtml(meta.purpose)}">${iconSvg(meta.icon)}<span class="ti-title">${meta.title}</span>${badge}<span class="ti-file">${s.file}.py</span></button>`;
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
      ? items.slice(0, 60).map(p => `<li class="${p.kind}"><button type="button" data-sec="${p.s.id}" data-line="${p.i}"><span class="dot"></span><span><span class="where">${SECTION_META[p.s.file].title} · line ${p.i + 1}</span>${withCode(p.msg)}</span></button></li>`).join('')
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
    renderOverlay(); renderPython(); renderExplain(); renderTree(); renderProblems();
  }

  function openSection(id, line) {
    activeSec().text = ta.value;
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
    ensureCaretVisible();
    syncScroll();
    const cur = caretLine();
    if (typingLine >= 0 && cur !== typingLine) { typingLine = -1; renderOverlay(); renderTree(); renderProblems(); }
    [...gutterInner.children].forEach((g, i) => g.classList.toggle('cur', i === cur));
    linkPython(scrollPy);
    renderExplain();
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
      items = LANG.TEMPLATES.filter(t => {
        const lead = t.pattern.split('‹')[0].toLowerCase();
        return (lead.startsWith(lower) || (lower.startsWith(lead.trim()) && lower.length <= lead.length + 1 && lead.trim().length)) && t.pattern.toLowerCase() !== lower;
      }).sort((a, b2) => (b2.sections.includes(file) - a.sections.includes(file))).slice(0, 7)
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
    typingLine = caretLine();
    activeSec().text = ta.value;
    ensureCaretVisible();
    renderOverlay();
    scheduleCompile();
    save();
  }

  ta.addEventListener('input', () => { onEdit(); updateAc(); });
  ta.addEventListener('scroll', () => { syncScroll(); if (!ac.hidden) updateAc(); });
  ta.addEventListener('click', () => { closeAc(); afterCaretMove(true); });
  ta.addEventListener('keyup', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(e.key) && ac.hidden) afterCaretMove(true);
  });
  ta.addEventListener('blur', () => setTimeout(closeAc, 150));

  ta.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); run(); return; }
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
      if (LANG.OPENS_BLOCK.test(before) && before.trim()) indent += '    ';
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

  pycode.addEventListener('mouseover', (e) => {
    const pl = e.target.closest('.pl');
    if (!pl || +pl.dataset.src < 0) { bandLink.hidden = true; return; }
    bandLink.hidden = false; bandLink.dataset.line = pl.dataset.src;
    placeBand(bandLink, +pl.dataset.src);
  });
  pycode.addEventListener('mouseleave', () => { bandLink.hidden = true; });
  pycode.addEventListener('click', (e) => {
    const pl = e.target.closest('.pl');
    if (pl && +pl.dataset.src >= 0) goToLine(+pl.dataset.src);
  });

  $('tree').addEventListener('click', (e) => { const b = e.target.closest('.tree-item'); if (b) openSection(b.dataset.id); });
  $('problems').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-sec]');
    if (b) openSection(b.dataset.sec, +b.dataset.line);
  });

  async function copyText(text, btn, label) {
    try { await navigator.clipboard.writeText(text); btn.textContent = 'Copied'; }
    catch (_) { btn.textContent = 'Copy blocked here'; }
    setTimeout(() => { btn.textContent = label; }, 1800);
  }
  $('btnCopy').addEventListener('click', () => { const r = secResult(activeSec().id); if (r) copyText(r.text, $('btnCopy'), 'Copy'); });

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
  function setStatus(text, cls) { const el = $('pyStatus'); el.textContent = text; el.className = 'py-status' + (cls ? ' ' + cls : ''); }
  function setAsking(on) {
    asking = on;
    termPrompt.textContent = on ? 'answer ›' : '❯';
    termPrompt.classList.toggle('asking', on);
    termIn.classList.toggle('asking', on);
    termIn.placeholder = on ? 'type your answer and press Enter' : 'type help, run, or any sentence or Python to try it';
    if (on) termIn.focus({ preventScroll: true });
  }

  async function ensurePython() {
    if (Runner.ready) return true;
    setStatus('Loading Python…');
    try {
      const v = await Runner.ensure((s) => setStatus(s));
      setStatus(`Python ${v} ready`, 'ready');
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
    if (type === 'ModuleNotFoundError') { const m = msg.match(/'([\w.]+)'/); return `This program needs the ${m ? m[1] : ''} toolkit, which isn't available in the browser. Run it on your computer after installing it (pip install ${m ? m[1].split('.')[0] : '…'}).`; }
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
    if (mode === 'read') { tLine('Run works on the program in Write mode. Use "Open as sentences" to bring imported code there.', 't-sys'); return; }
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
      if (where && where.line != null) {
        const sec = project.sections.find(s => s.id === where.sec);
        const sentence = sec.text.split('\n')[where.line].trim();
        runtimeMark = { sec: where.sec, line: where.line, msg: (f || 'The program stopped here.') + ` (Python said: ${r.type}: ${r.msg})` };
        tLink(`  Go to ${SECTION_META[sec.file].title}, line ${where.line + 1}: ${sentence}`, where.sec, where.line);
        if (where.sec === project.active) { renderOverlay(); renderExplain(); }
      }
    }
  }

  const HELP = [
    'Commands:',
    '  run      run the program (same as the Run button, or Ctrl+Enter)',
    '  clear    clear this terminal',
    '  files    list the project folders and the Python file each one makes',
    '  reset    forget values from earlier runs',
    '  restore  swap back to the project you had before the last blueprint or import',
    '  index    open the Index',
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
      const prev = store.get(PREVIOUS_KEY, null);
      if (!prev) return tLine('There is no earlier project to restore.', 't-sys');
      return replaceProject(prev, `Restored "${prev.name}".`);
    }
    if (low === 'files' || low === 'ls') {
      return tLine(project.name + '/\n' + project.sections.map(s => `  ${(s.file + '.py').padEnd(13)} ${SECTION_META[s.file].title}: ${SECTION_META[s.file].purpose}`).join('\n'), 't-help');
    }
    if (low === 'reset') { Runner.reset(); return tLine('Forgot all values from earlier runs.', 't-sys'); }
    if (!compiled) compile();
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

  $('termForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const val = termIn.value;
    termIn.value = '';
    if (asking && session && !session.done) {
      setAsking(false);
      tWrite(val + '\n', 't-echo');
      session.answers.push(val);
      session.shown += val.length + 1;
      step();
      return;
    }
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
    const G = LANG.GUIDE;
    const match = (...parts) => !q || parts.join(' ').toLowerCase().includes(q);
    let html = '';
    $('indexTitle').textContent = mode === 'read' ? `${G.name} · reading code` : `${G.name} · ${SECTION_META[file].title}`;
    if (!q) {
      html += `<div class="ix"><h3>What ${G.name} is for</h3><p>${withCode(G.purpose)}</p>
        ${mode === 'write' ? `<h3>This folder</h3><p>${withCode(G.sections[file])}</p>` : `<h3>Reading code</h3><p>Click a section to see what it does. Highlight any lines and press Summarise for just those. Summaries come from rules, not guesses: every sentence points at real lines.</p>`}
        <h3>Five rules that explain most of Python</h3><ol class="ix-rules">${G.rules.map((r, i) => `<li><span class="n">${i + 1}</span><div><b>${escHtml(r[0])}</b><span>${withCode(r[1])}</span></div></li>`).join('')}</ol></div>`;
    }
    const tpls = LANG.TEMPLATES.filter(t => (indexAll || q || t.sections.includes(file)) && match(t.pattern, t.py, t.tip, t.group));
    const groups = [...new Set(tpls.map(t => t.group))];
    html += `<div class="ix"><h3>Sentences${q ? '' : indexAll ? ' · all folders' : ' · for this folder'}${q ? '' : `<button type="button" class="ix-toggle" id="ixToggle">${indexAll ? 'Show this folder only' : 'Show all'}</button>`}</h3>`;
    html += groups.map(g => `<div class="ix-group">${escHtml(g)}</div>` + tpls.filter(t => t.group === g).map(t => {
      const i = LANG.TEMPLATES.indexOf(t);
      return `<div class="ix-item"><div class="ix-say">${escHtml(t.pattern).replace(/‹([^›]*)›/g, '<span class="s-slot">‹$1›</span>')}</div><button type="button" class="ix-insert" data-tpl="${i}">Insert</button><div class="ix-py">${escHtml(t.py)}</div>${t.tip ? `<div class="ix-tip">${withCode(t.tip)}</div>` : ''}</div>`;
    }).join('')).join('') || '<div class="ix-empty">No sentences match.</div>';
    html += '</div>';
    const words = LANG.WORDS.filter(w => match(w[0], w[1]));
    if (words.length) html += `<div class="ix"><h3>Words inside sentences</h3><table class="ix-words"><tbody>${words.map(w => `<tr><td>${escHtml(w[0])}</td><td>${escHtml(w[1])}</td></tr>`).join('')}</tbody></table></div>`;
    const hows = G.howtos.filter(h => match(h[0], h[1]));
    if (hows.length) html += `<div class="ix"><h3>How to…</h3>${hows.map(h => `<div class="ix-how"><b>${escHtml(h[0])}<button type="button" class="ix-insert" data-how="${G.howtos.indexOf(h)}">Insert</button></b><pre>${escHtml(h[1])}</pre></div>`).join('')}</div>`;
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
    if (b.dataset.tpl) insertSnippet(LANG.TEMPLATES[+b.dataset.tpl].pattern);
    if (b.dataset.how) insertSnippet(LANG.GUIDE.howtos[+b.dataset.how][1]);
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

  function renderBpList() {
    const built = BP.BUILT_IN.map((src, i) => ({ bp: BP.parse(src), sel: { src: 'built', i } }));
    const mine = myBlueprints.map((m, i) => ({ bp: BP.parse(m.source), sel: { src: 'mine', i } }));
    const item = ({ bp, sel }) => `<button type="button" class="bp-item${bpSel && bpSel.src === sel.src && bpSel.i === sel.i ? ' on' : ''}" data-src="${sel.src}" data-i="${sel.i}"><b>${escHtml(bp.title || 'Untitled')}</b><span>${escHtml(bp.about || '')}</span></button>`;
    const group = (label, list) => list.length ? `<div class="bp-group">${label}</div>` + list.map(item).join('') : '';
    const projects = built.filter(x => x.bp.kind === 'project').concat(mine.filter(x => x.bp.kind === 'project'));
    const snippets = built.filter(x => x.bp.kind === 'snippet').concat(mine.filter(x => x.bp.kind === 'snippet'));
    $('bpList').innerHTML = group('Start a project', projects.filter(x => x.sel.src === 'built'))
      + group(`Add to ${SECTION_META[activeSec().file].title}`, snippets.filter(x => x.sel.src === 'built'))
      + `<div class="bp-group">Your blueprints</div>`
      + (mine.length ? mine.map(item).join('') : '<p class="bp-none">None yet. Edit a copy of any blueprint, or turn your current project into one.</p>')
      + `<div class="bp-mk"><button type="button" class="btn small" id="bpFromProject">Make one from this project</button><button type="button" class="btn small" id="bpPaste">Write or paste one</button></div>`;
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
      const label = sec === 'here' ? `Goes into ${SECTION_META[activeSec().file].title} at the cursor` : `${SECTION_META[sec].title} · ${sec}.py`;
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
    if (!bpSel) { box.innerHTML = '<p class="bp-none">Pick a blueprint.</p>'; return; }
    const bp = BP.parse(bpSource(bpSel));
    const isProject = bp.kind === 'project';
    const where = isProject ? (bp.layout === 'structured' ? 'Project · Settings, Tools and Main program' : 'Project · one Main program file') : `Snippet · adds lines to ${SECTION_META[activeSec().file].title}`;
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
    if (!bpSel) bpSel = { src: 'built', i: 0 };
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
    if (it) { bpSel = { src: it.dataset.src, i: +it.dataset.i }; bpValues = {}; bpEditing = null; renderBpList(); renderBpDetail(); return; }
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
    if (id === 'bpUse') {
      const bp = BP.parse(bpSource(bpSel));
      if (bp.errors.length) return;
      closeBlueprints();
      if (bp.kind === 'project') replaceProject(projectFromBlueprint(bp, bpValues), `Built "${bp.title}" from its blueprint. Press Run to try it.`);
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
  const KIND_LABEL = { about: 'About', imports: 'Toolkits', settings: 'Settings', steps: 'Steps', tool: 'Tool', route: 'Web route', class: 'Class', start: 'Start' };
  const ROLE_ORDER = ['entry', 'settings', 'models', 'helpers', 'routes', 'script', 'package', 'tests'];
  const SKIP_DIRS = new Set(['venv', '.venv', 'env', '.env', 'node_modules', '__pycache__', '.git', 'site-packages', 'build', 'dist', '.tox', '.mypy_cache', '.pytest_cache', '.idea', '.vscode']);
  const EXTRA_FILE = /(^|\/)(readme(\.\w+)?|requirements[\w.-]*\.txt|pyproject\.toml|pipfile)$/i;

  function saveReads() {
    try { localStorage.setItem(READ_KEY, JSON.stringify(reads)); }
    catch (_) { tLine('This project is too big to remember after a reload, but you can read it now.', 't-sys'); }
  }

  function setMode(next) {
    mode = next;
    $('modeWrite').setAttribute('aria-selected', String(next === 'write'));
    $('modeRead').setAttribute('aria-selected', String(next === 'read'));
    $('writeView').hidden = next !== 'write';
    $('explain').hidden = next !== 'write';
    $('writeSide').hidden = next !== 'write';
    $('readView').hidden = next !== 'read';
    $('readSide').hidden = next !== 'read';
    $('work').classList.toggle('reading', next === 'read');
    if (next === 'read') renderRead();
    else { measure(); syncScroll(); }
    if (!$('index').hidden) renderIndex();
  }
  $('modeWrite').addEventListener('click', () => setMode('write'));
  $('modeRead').addEventListener('click', () => setMode('read'));

  const pyFiles = () => reads.files.filter(f => /\.py$/.test(f.name));
  const curFile = () => (reads.active >= 0 ? pyFiles()[reads.active] : null);
  const fileInfo = (path) => proj && proj.files.find(x => x.path === path);
  const curAnalysis = () => { const f = curFile(); const i = f && fileInfo(f.name); return i ? i.analysis : null; };
  const shortPath = (p) => (proj && proj.name && p.startsWith(proj.name + '/') ? p.slice(proj.name.length + 1) : p);

  /* [[path]] and [[path#name]] in reader text become links to that file. */
  function linkify(html) {
    return html.replace(/\[\[([^\]#]+)(?:#([^\]]+))?\]\]/g, (m, path, name) => {
      const label = name ? `<code>${escHtml(name)}</code> <span class="dim">(${escHtml(shortPath(path))})</span>` : `<code>${escHtml(shortPath(path))}</code>`;
      return `<button type="button" class="linklike" data-file="${escHtml(path)}"${name ? ` data-name="${escHtml(name)}"` : ''}>${label}</button>`;
    });
  }
  const rich = (s) => linkify(withCode(s));

  async function analyse() {
    if (!reads.files.length) { proj = null; return; }
    $('rdSum').innerHTML = '<p class="sum-empty">Reading the code… (the first time, this loads Python into the page)</p>';
    if (!(await ensurePython())) { $('rdSum').innerHTML = '<p class="sum-empty">Python couldn\'t start, so the code can\'t be read here.</p>'; return; }
    try {
      const R = await Runner.reader((s) => setStatus(s));
      proj = R.analyzeProject(reads.files);
    } catch (e) {
      proj = null;
      $('rdSum').innerHTML = `<p class="sum-empty">The reader hit a problem: ${escHtml(e.message)}</p>`;
    }
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
    const extras = reads.files.filter(f => !/\.py$/.test(f.name));
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
    $('rdOverview').innerHTML = a ? (a.ok ? rich(a.overview) + (info && (info.imported_by.length || info.imports.length) ? `<span class="rd-links">${info.imports.length ? ' Uses ' + info.imports.map(p => `[[${p}]]`).join(', ') + '.' : ''}${info.imported_by.length ? ' Used by ' + info.imported_by.map(p => `[[${p}]]`).join(', ') + '.' : ''}</span>` : '') : `<span class="bad-text">This file can't be read as Python. ${escHtml(a.error)}</span>`) : 'Reading…';
    $('rdOverview').innerHTML = linkify($('rdOverview').innerHTML);
    const secs = a && a.ok ? a.sections : [];
    const startOf = new Map(secs.map(s => [s.start, s]));
    const secOfLine = (ln) => secs.find(s => ln >= s.start && ln <= s.end);
    $('rdCode').innerHTML = file.source.split('\n').map((l, i) => {
      const ln = i + 1;
      const s = secOfLine(ln);
      const head = startOf.get(ln);
      const label = head ? `<div class="rl-sec" data-sec="${head.id}"><span class="chip k-${head.kind}">${KIND_LABEL[head.kind]}</span>${escHtml(head.title)}${head.warnings.length ? `<span class="warn-dot" title="${head.warnings.length} thing${head.warnings.length > 1 ? 's' : ''} worth checking">!</span>` : ''}</div>` : '';
      return `${label}<div class="rl${s ? ' in-sec' : ''}${s && s.id % 2 ? ' alt' : ''}" data-line="${ln}" data-sec="${s ? s.id : ''}"><span class="ln">${ln}</span><span class="pc">${hlPy(l) || ' '}</span></div>`;
    }).join('');
    $('rdOutline').innerHTML = secs.map(s => `<button type="button" class="ol-item" data-sec="${s.id}"><span class="chip k-${s.kind}">${KIND_LABEL[s.kind]}</span><span class="ol-t">${escHtml(s.title)}</span>${s.warnings.length ? '<span class="warn-dot">!</span>' : ''}<span class="ol-l">${s.start}–${s.end}</span></button>`).join('');
    renderFocus();
  }

  /* Project overview: what it is, where to start, how files connect, what to check. */
  function renderProject() {
    $('rdName').textContent = proj ? proj.name : 'Project';
    $('rdOverview').textContent = proj ? `${proj.files.length} Python files` : 'Reading…';
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
    const R = await Runner.reader();
    readFocus = { type: 'range', summary: R.summarise(curFile().source, r.start, r.end, curFile().name) };
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
    if (onReadLink(e)) return;
    if (e.target.id === 'rdImport') openImport();
    if (e.target.id === 'rdExample') loadExampleProject();
  });
  $('rdOverview').addEventListener('click', onReadLink);
  $('rdFiles').addEventListener('click', (e) => {
    const b = e.target.closest('.tree-item');
    if (!b) return;
    reads.active = +b.dataset.i; readFocus = null; saveReads(); renderRead();
  });

  $('btnToSentences').addEventListener('click', async () => {
    const file = curFile();
    const R = await Runner.reader();
    const res = R.toSentences(file.source);
    if (!res.ok) { tLine('This file can\'t be turned into sentences: ' + res.error, 't-err'); return; }
    const next = { version: 1, lang: 'python', name: slug(file.name.split('/').pop()), sections: [{ id: 'main', file: 'main', text: res.text }], active: 'main' };
    replaceProject(next, `Opened ${shortPath(file.name)} as sentences. Lines that can't be said in words yet stay as "python:" lines, exactly as written.`);
    const check = R.compare(file.source, secResult('main').text);
    if (check.same) tLine('✓ Checked: these sentences make exactly the same program as the original file.', 't-ok');
    else tLine(`Note: the sentences differ from the original ${check.error ? '(' + check.error + ')' : 'at lines ' + check.differs.map(d => d[0] === d[1] ? d[0] : d[0] + '–' + d[1]).join(', ')}. Check those parts before relying on them.`, 't-err');
  });

  /* ---------- Import: paste, files, a folder, a .zip, or drag and drop ---------- */

  function keepPath(path) {
    const parts = path.replace(/\\/g, '/').split('/');
    if (parts.slice(0, -1).some(p => SKIP_DIRS.has(p) || p.endsWith('.egg-info'))) return null;
    const name = parts[parts.length - 1];
    if (name === '.env' || name.startsWith('.env.')) return 'secret';
    if (name.endsWith('.py')) return 'py';
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

  async function loadExampleProject() {
    closeImport();
    try {
      const base = new URL('samples/taskboard/', location.href).href;
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
    if (!/\.py\w?$/.test(name)) name += '.py';
    closeImport();
    $('impText').value = '';
    addFiles([{ name, source: text.replace(/\r\n?/g, '\n') }]);
  });

  /* A folder, zip or example replaces what was imported before; single files are added to it. */
  async function importProject(files, note) {
    closeImport();
    if (!files.some(f => /\.py$/.test(f.name))) { tLine('No Python files were found there.', 't-err'); return; }
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
    const n = pyFiles().length;
    tLine(`Imported ${n} Python file${n === 1 ? '' : 's'}.` + (note ? ' ' + note : ''), 't-sys');
  }

  /* ------------------------------------------------------------------ */
  /* Keyboard + start                                                    */
  /* ------------------------------------------------------------------ */

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && document.activeElement !== ta) { e.preventDefault(); run(); }
    if (e.key === 'Escape') {
      if (!$('bpModal').hidden) closeBlueprints();
      else if (!$('impModal').hidden) closeImport();
      else if (!ac.hidden) closeAc();
      else if (!$('index').hidden) closeIndex();
    }
  });

  function start() {
    measure();
    ta.value = activeSec().text;
    renderSectionHeader();
    refreshAll();
    tLine('IntuiCode terminal. Press Run to run your program, or type help.', 't-sys');
    setTimeout(async () => {
      await ensurePython();
      if (reads.files.length) { await analyse(); if (mode === 'read') renderRead(); }
    }, 1200);
  }

  window.addEventListener('resize', () => { measure(); syncScroll(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { measure(); syncScroll(); });
  start();
})();

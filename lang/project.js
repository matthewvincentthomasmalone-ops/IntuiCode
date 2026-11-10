/* IntuaCode — a project: a tree of files, each in its own language.
 *
 * Each file (a "section") has an id, a path, a language id (lang/languages.js) and its text. The language
 * says how it's written: in sentences (Python, HTML, CSS, JavaScript, C++, Arduino), as code that IntuaCode
 * reads to you, or as notes and data kept as written.
 *
 * The writers work by role: Python by module name (settings, tools, main…), a website by structure /
 * styling / mechanics, C++ by program, Arduino by sketch. A file's role (`file`) is worked out from its
 * path and language, so projects saved before files had paths (where the id is the role: 'main',
 * 'structure'…) compile exactly as they always did.
 *
 * No page here (no DOM): the app and the tests both use it.
 */
(function (root) {
  'use strict';

  const LANGS = root.IntuiLanguages;
  // the files projects always had, by role
  const CLASSIC_PATH = { settings: 'settings.py', tools: 'tools.py', main: 'main.py', structure: 'index.html', styling: 'style.css', mechanics: 'script.js', program: 'main.cpp', sketch: 'sketch.ino' };
  const CLASSIC_LANG = { structure: 'html', styling: 'css', mechanics: 'js', program: 'cpp', sketch: 'arduino' };
  const ENGINE = { python: 'python', html: 'website', css: 'website', js: 'website', cpp: 'cpp', arduino: 'arduino' };
  const WEB_ROLE = { html: 'structure', css: 'styling', js: 'mechanics' };
  const MAX_FILES = 200;

  const isSentences = (sec) => !!ENGINE[sec.lang];
  const writeOf = (sec) => (LANGS.byId(sec.lang) || { write: 'text' }).write;   // sentences, code or text

  function roleOf(sec) {
    if (sec.lang === 'python') return sec.path.replace(/\.py$/i, '').replace(/\//g, '.');
    if (WEB_ROLE[sec.lang]) return WEB_ROLE[sec.lang];
    if (sec.lang === 'cpp') return 'program';
    if (sec.lang === 'arduino') return 'sketch';
    return writeOf(sec);
  }

  /* A path IntuaCode will write: folders and a name, never outside the project or into its own folders.
     '' when it's fine, or why not. */
  const SAFE_PATH = /^(?:[A-Za-z0-9_][\w+ .-]{0,63}\/){0,5}[A-Za-z0-9_][\w+ .-]{0,63}$/;
  function pathProblem(path, lang) {
    path = String(path);
    if (!SAFE_PATH.test(path) || /(^|\/)\.\.?(\/|$)|\s\/|\/\s|\s$/.test(path)) return 'A file name uses letters, numbers, spaces, dots, dashes and underscores, and folders are separated with /.';
    if (/^(?:\.intuicode|images)\//i.test(path)) return `${path.split('/')[0]}/ is kept for IntuaCode itself. Choose another folder.`;
    if (lang === 'python' && !/^(?:[A-Za-z_]\w*\/)*[A-Za-z_]\w*\.py$/.test(path)) return 'A Python file\'s name and folders must be Python names (letters, numbers and _, not starting with a number), because other files import it by that name.';
    return '';
  }

  /* Every project, however it was made (a blueprint, a kit, a folder, the browser), as a file tree: each
   * file gets its path and language (from its role if it only had one) and its role, and the project its
   * start file and kind. Null if two files would be written to the same place, or two Python files would
   * be the same module. */
  function normalized(p) {
    for (const s of p.sections) {
      if (!s.path) { s.path = CLASSIC_PATH[s.file] || s.file + '.py'; s.lang = CLASSIC_LANG[s.file] || 'python'; }
      s.file = roleOf(s);
    }
    const paths = p.sections.map(s => s.path.toLowerCase());   // (Windows and macOS don't tell a.py from A.py)
    if (new Set(paths).size !== paths.length || paths.some(x => paths.some(y => y.startsWith(x + '/')))) return null;
    const py = p.sections.filter(s => s.lang === 'python').map(s => s.file);
    if (new Set(py).size !== py.length) return null;
    if (!p.sections.some(s => s.id === p.start)) {
      const pick = (role) => p.sections.find(s => s.file === role);
      p.start = (pick('main') || pick('structure') || pick('program') || pick('sketch') || p.sections.find(isSentences) || p.sections[0]).id;
    }
    if (!p.sections.some(s => s.id === p.active)) p.active = (p.sections.find(s => s.id === (p.kind === 'website' ? 'structure' : 'main')) || p.sections[p.sections.length - 1]).id;
    const start = p.sections.find(s => s.id === p.start);
    const lead = isSentences(start) ? start : p.sections.find(isSentences);
    p.kind = lead ? ENGINE[lead.lang] : 'files';
    p.version = 2;
    return p;
  }

  /* The files of a project read back from the browser or from a folder's .intuicode/project.json, checked
   * (a project file from someone else can't name a path outside the project), or null. Older projects
   * name their files by role only: `kindFiles` lists the roles each kind of project could have. */
  function checkedSections(p, kindFiles) {
    if (!p || typeof p !== 'object' || !Array.isArray(p.sections) || !p.sections.length || p.sections.length > MAX_FILES) return null;
    let sections;
    if (p.sections.every(s => s && typeof s.path === 'string')) {
      sections = p.sections.map(s => (/^[\w-]{1,40}$/.test(s.id) && LANGS.byId(s.lang) && !pathProblem(s.path, s.lang) ? { id: s.id, path: s.path, lang: s.lang, text: typeof s.text === 'string' ? s.text : '' } : null));
    } else {
      const kind = kindFiles[p.kind] ? p.kind : 'python';
      sections = p.sections.map(s => (s && kindFiles[kind].includes(s.file) && /^[\w-]{1,40}$/.test(s.id) ? { id: s.id, file: s.file, text: typeof s.text === 'string' ? s.text : '' } : null));
      if (sections.length > kindFiles[kind].length) return null;
    }
    if (sections.includes(null) || new Set(sections.map(s => s.id)).size !== sections.length) return null;
    return sections;
  }

  /* A website's main page: its HTML, CSS and JavaScript, compiled together (index.html, style.css and
   * script.js when there are several). */
  function webTriple(sections) {
    const pick = (role, canon) => sections.find(s => s.file === role && s.path === canon) || sections.find(s => s.file === role);
    return { structure: pick('structure', 'index.html'), styling: pick('styling', 'style.css'), mechanics: pick('mechanics', 'script.js') };
  }

  /* Each engine compiles its own files: Python together (each file sees the ones before it, so the start
   * file goes last), the main page together and other pages, styles and scripts each against it, C++
   * together, Arduino together. Code and notes files aren't compiled. W: { LANG, WEB, CPP }, the writers. */
  function compileAll(p, W) {
    const groups = {};
    for (const s of p.sections) if (ENGINE[s.lang]) (groups[ENGINE[s.lang]] = groups[ENGINE[s.lang]] || []).push(s);
    const results = {}, syms = new Map();
    const take = (out) => { Object.assign(results, out.results); for (const [k, v] of out.syms) if (!syms.has(k)) syms.set(k, v); return out; };
    const pyOrder = groups.python && [...groups.python.filter(s => s.id !== p.start), ...groups.python.filter(s => s.id === p.start)];
    const pySyms = groups.python ? take(W.LANG.compileProject({ ...p, sections: pyOrder })).syms : new Map();
    let page = null, web = null;
    if (groups.website) {
      const t = webTriple(groups.website), main = Object.values(t).filter(Boolean);
      const files = p.sections.map(s => ({ path: s.path, lang: s.lang }));   // (a page links the style sheets and scripts it loads)
      web = take(W.WEB.compileWebsite({ ...p, files, sections: main })).shared || null;   // the page's names, groups and elements
      for (const s of groups.website) {
        if (main.includes(s)) continue;
        results[s.id] = W.WEB.compileWebsite({ ...p, files, sections: [...main.filter(m => m.file !== s.file), s] }).results[s.id];
      }
      page = t;
    }
    if (groups.cpp) take(W.CPP.compileCppProject({ ...p, kind: 'cpp', sections: groups.cpp }));
    if (groups.arduino) take(W.CPP.compileCppProject({ ...p, kind: 'arduino', sections: groups.arduino }));
    return { results, syms, pySyms, page, web };
  }

  /* ---------- Notes and data, shown as what they are ---------- */

  const escHtml = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* Markdown, as a page. Everything is escaped first; only the marks below become formatting. Links are
   * shown with their address (never followed from the editor) and pictures by their description. */
  function mdInline(s) {
    return escHtml(s)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<span class="md-pic" title="$2">[picture: $1]</span>')
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<span class="md-link" title="$2">$1</span>')
      .replace(/\*\*([^*]+)\*\*|__([^_]+)__/g, (m, a, b) => `<b>${a || b}</b>`)
      .replace(/(^|[\s(])\*([^*\s][^*]*)\*|(^|[\s(])_([^_\s][^_]*)_/g, (m, p1, a, p2, b) => `${p1 || p2 || ''}<i>${a || b}</i>`)
      .replace(/~~([^~]+)~~/g, '<s>$1</s>');
  }
  function mdToHtml(text) {
    const lines = String(text).replace(/\r\n?/g, '\n').split('\n'), out = [];
    let para = [], list = null, fence = null, code = [], table = null;
    const flushPara = () => { if (para.length) out.push(`<p>${mdInline(para.join(' '))}</p>`); para = []; };
    const flushList = () => { if (list) out.push(`<${list.tag}>${list.items.map(i => `<li>${i}</li>`).join('')}</${list.tag}>`); list = null; };
    const flushTable = () => {
      if (table) out.push(`<table class="md-table"><thead><tr>${table.head.map(c => `<th>${mdInline(c)}</th>`).join('')}</tr></thead><tbody>${table.rows.map(r => `<tr>${r.map(c => `<td>${mdInline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
      table = null;
    };
    const cells = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
    const flush = () => { flushPara(); flushList(); flushTable(); };
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (fence) { if (l.trim().startsWith(fence)) { out.push(`<pre class="md-code">${escHtml(code.join('\n'))}</pre>`); fence = null; code = []; } else code.push(l); continue; }
      const f = l.match(/^\s*(```|~~~)/);
      if (f) { flush(); fence = f[1]; continue; }
      let m;
      if (!l.trim()) { flush(); continue; }
      if ((m = l.match(/^\s*(#{1,6})\s+(.*?)\s*#*\s*$/))) { flush(); out.push(`<h${m[1].length}>${mdInline(m[2])}</h${m[1].length}>`); continue; }
      if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(l)) { flush(); out.push('<hr>'); continue; }
      if (table) { table.rows.push(cells(l)); continue; }
      if (/\|/.test(l) && lines[i + 1] && /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(lines[i + 1])) { flush(); table = { head: cells(l), rows: [] }; i++; continue; }
      if ((m = l.match(/^\s*>\s?(.*)$/))) { flush(); out.push(`<blockquote>${mdInline(m[1])}</blockquote>`); continue; }
      if ((m = l.match(/^\s*([-*+]|\d+[.)])\s+(?:\[([ xX])\]\s+)?(.*)$/))) {
        flushPara();
        const tag = /\d/.test(m[1]) ? 'ol' : 'ul';
        if (!list || list.tag !== tag) { flushList(); list = { tag, items: [] }; }
        list.items.push((m[2] ? `<span class="md-tick">${m[2] === ' ' ? '☐' : '☑'}</span> ` : '') + mdInline(m[3]));
        continue;
      }
      if (list && /^\s{2,}\S/.test(l)) { list.items[list.items.length - 1] += ' ' + mdInline(l.trim()); continue; }
      flushList(); flushTable();
      para.push(l.trim());
    }
    if (fence) out.push(`<pre class="md-code">${escHtml(code.join('\n'))}</pre>`);
    flush();
    return out.join('\n');
  }

  /* CSV rows, with quoted cells ("a, b" and "say ""hi"""), at most `max` of them. */
  function csvRows(text, max = 200) {
    const rows = []; let row = [], cell = '', q = false;
    text = String(text);
    for (let i = 0; i < text.length && rows.length < max; i++) {
      const c = text[i];
      if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; continue; }
      if (c === '"') q = true; else if (c === ',') { row.push(cell); cell = ''; } else if (c === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; } else cell += c;
    }
    if ((cell || row.length) && rows.length < max) { row.push(cell); rows.push(row); }
    return rows;
  }

  /* What a value in JSON is, in a few words. */
  const jsonKind = (v) => (Array.isArray(v) ? `a list of ${v.length}` : v === null ? 'nothing (null)' : typeof v === 'object' ? `a group of ${Object.keys(v).length}` : typeof v === 'string' ? 'text' : typeof v === 'number' ? 'a number' : 'yes/no');

  root.IntuiProject = { CLASSIC_PATH, CLASSIC_LANG, ENGINE, WEB_ROLE, MAX_FILES, isSentences, writeOf, roleOf, pathProblem, normalized, checkedSections, webTriple, compileAll, mdInline, mdToHtml, csvRows, jsonKind };
})(typeof window !== 'undefined' ? window : globalThis);

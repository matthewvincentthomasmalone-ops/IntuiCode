/* IntuCode — Unity mode: one pane of real code, any part of which can be said in sentences in place.
 *
 * You write or paste code in one language. Select some of it and De-Regex/Translate it: those lines become
 * sentences, right there, and are marked as a region. Edit the sentences; Re-Regex turns them back into code
 * in the same place. A region nobody changed goes back exactly as it was (its original code is kept), so
 * looking never changes anything. A changed region is translated in the context of the rest of the file:
 * the code around it is given to the writer as exact lines (python:, js:, c++: …), so the names and kinds
 * it makes are known, and only the region's own lines are taken back.
 *
 *   expand(lang, lines, from, to)                  -> { from, to }: the selection grown to whole statements
 *   toWords(lang, lines, from, to, convert)        -> Promise<{ words, exact, reason, original, base }>
 *        convert(kind, source) -> { text, exact, reason } (or a promise of it): the readers, from the shell
 *   toCode(lang, lines, regions, i, W)             -> { code, needs, problems }: region i as code
 *   reRegex(lang, lines, regions, i, W)            -> { ok, lines, regions, needs, problems }
 *   adjust(regions, before, after, caretRegion)    -> regions, after an edit of the text
 *
 * A region is { from, to, original: [code lines], words: [the sentences as made], base: indentation }.
 * W: { LANG (IntuiLang.python), WEB, CPP }, the writers. No DOM here.
 */
(function (root) {
  'use strict';

  const LANGS = ['python', 'html', 'css', 'js', 'cpp', 'arduino'];
  const RAW = { python: 'python: ', html: 'html: ', css: 'css: ', js: 'js: ', cpp: 'c++: ', arduino: 'c++: ' };
  const UNIT = { python: 4, html: 2, css: 2, js: 2, cpp: 4, arduino: 4 };   // the writers' indentation per level
  const KIND = { html: 'html', css: 'css', js: 'js', cpp: 'cpp', arduino: 'arduino', python: 'python' };

  const indentOf = (s) => String(s).match(/^[ \t]*/)[0];
  const width = (ind) => ind.replace(/\t/g, '    ').length;
  const blank = (s) => !String(s).trim();

  /* The indentation one level is in this text: a tab, or the commonest step between lines (2 or 4 spaces). */
  function unitOf(lines) {
    if (lines.some(l => /^\t/.test(l))) return '\t';
    const steps = {};
    let last = 0;
    for (const l of lines) {
      if (blank(l)) continue;
      const w = width(indentOf(l));
      if (w > last) steps[w - last] = (steps[w - last] || 0) + 1;
      last = w;
    }
    const best = Object.entries(steps).filter(([d]) => +d === 2 || +d === 4).sort((a, b) => b[1] - a[1])[0];
    return ' '.repeat(best ? +best[0] : 4);
  }

  /* ---------- Code shape: brackets and tags, outside text and comments ---------- */

  /* How much each line opens (+) or closes (-): brackets for most languages, tags for HTML. Text in quotes
     and comments don't count. */
  function depths(lang, lines) {
    const out = [];
    let inBlock = false;   // inside /* … */ or <!-- … -->
    let inTriple = null;   // inside a Python """ … """
    for (const raw of lines) {
      let s = String(raw), d = 0, lo = 0;
      const step = (n) => { d += n; lo = Math.min(lo, d); };
      if (lang === 'html') {
        s = s.replace(/<!--[\s\S]*?-->/g, '');
        if (inBlock) { const e = s.indexOf('-->'); if (e < 0) { out.push({ d: 0, lo: 0 }); continue; } s = s.slice(e + 3); inBlock = false; }
        const c = s.indexOf('<!--'); if (c >= 0) { s = s.slice(0, c); inBlock = true; }
        s = s.replace(/"[^"]*"|'[^']*'/g, '""');
        for (const m of s.matchAll(/<(\/?)([A-Za-z][\w-]*)[^>]*?(\/?)>/g)) {
          if (/^(?:area|base|br|col|embed|hr|img|input|link|meta|source|track|wbr|!doctype)$/i.test(m[2]) || m[3]) continue;
          step(m[1] ? -1 : 1);
        }
        out.push({ d, lo });
        continue;
      }
      if (lang === 'python' && inTriple) {
        const e = s.indexOf(inTriple);
        if (e < 0) { out.push({ d: 0, lo: 0 }); continue; }
        s = s.slice(e + 3); inTriple = null;
      }
      let i = 0;
      while (i < s.length) {
        const c = s[i], two = s.slice(i, i + 2);
        if (inBlock) { if (two === '*/') { inBlock = false; i += 2; } else i++; continue; }
        if (lang !== 'python' && two === '/*') { inBlock = true; i += 2; continue; }
        if ((lang !== 'python' && lang !== 'css' && two === '//') || (lang === 'python' && c === '#')) break;
        if (lang === 'python' && (s.startsWith('"""', i) || s.startsWith("'''", i))) {
          const q = s.slice(i, i + 3), e = s.indexOf(q, i + 3);
          if (e < 0) { inTriple = q; break; }
          i = e + 3; continue;
        }
        if (c === '"' || c === "'" || (c === '`' && lang === 'js')) {
          let j = i + 1;
          while (j < s.length && s[j] !== c) j += s[j] === '\\' ? 2 : 1;
          i = j + 1; continue;
        }
        if ('([{'.includes(c)) step(1);
        else if (')]}'.includes(c)) step(-1);
        i++;
      }
      out.push({ d, lo });
    }
    return out;
  }

  /* ---------- Growing a selection to whole statements ---------- */

  const PY_MORE = /^(?:elif\b|else\s*:|except\b|finally\s*:)/;
  const PY_HEAD = /^(?:if|elif|else|for|while|try|except|finally|with|def|class|async)\b|^@/;
  const BRACE_MORE = /^(?:\}\s*)?(?:else\b|catch\b|finally\b|while\s*\(.*\)\s*;)/;

  function expand(lang, lines, from, to) {
    from = Math.max(0, Math.min(from, lines.length - 1)); to = Math.max(from, Math.min(to, lines.length - 1));
    while (from < to && blank(lines[from])) from++;
    while (to > from && blank(lines[to])) to--;
    if (blank(lines[from])) return null;
    const prevSolid = (i) => { for (let j = i - 1; j >= 0; j--) if (!blank(lines[j])) return j; return -1; };
    const nextSolid = (i) => { for (let j = i + 1; j < lines.length; j++) if (!blank(lines[j])) return j; return -1; };
    const w = (i) => width(indentOf(lines[i]));
    for (let guard = 0; guard < 50; guard++) {
      const before = from + ':' + to;
      if (lang === 'python') {
        let base = Infinity;
        for (let i = from; i <= to; i++) if (!blank(lines[i])) base = Math.min(base, w(i));
        // a first line deeper than the rest: take in the block it's in, up to its header
        while (w(from) > base) { const p = prevSolid(from); if (p < 0) break; let j = p; while (j >= 0 && (blank(lines[j]) || w(j) >= w(from))) j--; if (j < 0) break; from = j; }
        // "else:" / "except" / "elif": with the statement they belong to; decorators with what they decorate
        while (PY_MORE.test(lines[from].trim()) || (prevSolid(from) >= 0 && /^@/.test(lines[prevSolid(from)].trim()) && w(prevSolid(from)) === w(from))) {
          let j = prevSolid(from);
          while (j >= 0 && (blank(lines[j]) || w(j) > w(from))) j--;
          if (j < 0) break;
          from = j;
        }
        base = w(from);
        // the body of every block in it, and the else / except parts after it
        for (;;) {
          const n = nextSolid(to);
          if (n < 0) break;
          if (w(n) > base || (w(n) === base && PY_MORE.test(lines[n].trim()))) { to = n; continue; }
          break;
        }
      } else {
        const ds = depths(lang, lines);
        // closing what opened before it: start where that opened
        let d = 0, lo = 0;
        for (let i = from; i <= to; i++) { lo = Math.min(lo, d + ds[i].lo); d += ds[i].d; }
        while (lo < 0 && from > 0) {
          from--;
          d = 0; lo = 0;
          for (let i = from; i <= to; i++) { lo = Math.min(lo, d + ds[i].lo); d += ds[i].d; }
        }
        // opening something: up to where it closes
        while (d > 0 && to < lines.length - 1) { to++; d += ds[to].d; }
        // } else { … }, } catch …: the rest of the statement
        const n = nextSolid(to);
        if (lang !== 'css' && lang !== 'html' && n >= 0 && BRACE_MORE.test(lines[n].trim()) && ds[to].d <= 0) to = n;
      }
      if (lang === 'python') {
        // brackets carried over to the next lines
        const ds = depths(lang, lines);
        let d = 0;
        for (let i = from; i <= to; i++) d += ds[i].d;
        while (d > 0 && to < lines.length - 1) { to++; d += ds[to].d; }
      }
      if (before === from + ':' + to) break;
    }
    return { from, to };
  }

  /* ---------- Code -> sentences ---------- */

  /* Brace depth at the start of each line: is a line inside a tool (C++, Arduino)? */
  function insideAt(lang, lines, at) {
    const ds = depths(lang, lines);
    let d = 0;
    for (let i = 0; i < at; i++) d += ds[i].d;
    return d > 0;
  }

  /* The selected code as sentences. The code is taken out of its place (its indentation removed), wrapped
     where its language needs it to be a whole file (statements inside a C++ tool go in a main, inside an
     Arduino sketch in "over and over"), read by the shell's converter, and unwrapped again. */
  async function toWords(lang, lines, from, to, convert) {
    const original = lines.slice(from, to + 1);
    const solid = original.filter(l => !blank(l));
    const base = solid.reduce((b, l) => (width(indentOf(l)) < width(b) ? indentOf(l) : b), indentOf(solid[0] || ''));
    const ded = original.map(l => (l.startsWith(base) ? l.slice(base.length) : l.trimStart()));
    let source = ded.join('\n') + '\n', unwrap = (t) => t;
    const inside = (lang === 'cpp' || lang === 'arduino') && insideAt(lang, lines, from);
    if (inside && lang === 'cpp') source = 'int main() {\n' + ded.map(l => (l ? '    ' + l : l)).join('\n') + '\n}\n';
    if (inside && lang === 'arduino') {
      source = 'void setup() {\n}\n\nvoid loop() {\n' + ded.map(l => (l ? '    ' + l : l)).join('\n') + '\n}\n';
      unwrap = (t) => { const ls = t.split('\n'), at = ls.findIndex(l => /^over and over\s*$/i.test(l)); return at < 0 ? t : ls.slice(at + 1).map(l => l.replace(/^ {4}/, '')).join('\n'); };
    }
    const res = await convert(KIND[lang], source);
    if (!res || res.ok === false || typeof res.text !== 'string') return { words: null, exact: false, reason: (res && res.reason) || 'it couldn\'t be read', original, base };
    let words = unwrap(res.text).split('\n');
    // what a reader adds for a whole file: section notes (Python), the page's own settings (HTML)
    if (lang === 'python') words = words.filter(l => !/^note: ── .* ──$/.test(l));
    if (lang === 'html') while (words.length && /^(?:no doctype|no page language|no title|leave out the character set|leave out the viewport setting)$/.test(words[0].trim())) words.shift();
    while (words.length && blank(words[0])) words.shift();
    while (words.length && blank(words[words.length - 1])) words.pop();
    // blank lines between sentences: as many as the code had between those statements is impossible to
    // know, so they're kept where the reader put them, at most one in a row
    words = words.filter((l, i) => !blank(l) || !blank(words[i - 1] || 'x'));
    return { words: words.map(l => (l ? base + l : l)), exact: res.exact !== false, reason: res.reason || null, original, base };
  }

  /* ---------- Sentences -> code ---------- */

  const regionAt = (regions, i) => regions.findIndex(r => i >= r.from && i <= r.to);

  /* The whole text as one sentence file: the regions' sentences as they are, every other line as an exact
     line (python: …) at its own indentation, so the writer knows the names around the region. map[n] is the
     text's line for sentence line n (-1 for a line added only to give the writer a place). */
  function sentenceFile(lang, lines, regions, i) {
    const out = [], map = [];
    const r = regions[i];
    if (lang === 'html') {
      // a page's parts nest by indentation, which exact lines can't give: the region on its own
      const solid = lines.slice(r.from, r.to + 1).filter(l => !blank(l));
      const cut = solid.reduce((b, l) => Math.min(b, width(indentOf(l))), Infinity);
      for (let n = r.from; n <= r.to; n++) { out.push(lines[n].replace(/^\t+/, (t) => '    '.repeat(t.length)).slice(Math.min(cut, width(indentOf(lines[n]))))); map.push(n); }
      return { text: out.join('\n'), map };
    }
    const inLoop = lang === 'arduino' && insideAt('cpp', codeView(lines, regions), codeIndex(regions, r.from));
    for (let n = 0; n < lines.length; n++) {
      const at = regionAt(regions, n);
      if (n === r.from && inLoop) { out.push(' '.repeat(Math.max(0, width(r.base) - 4)) + 'over and over'); map.push(-1); }
      if (at >= 0) { out.push(lines[n]); map.push(n); continue; }
      out.push(blank(lines[n]) ? '' : indentOf(lines[n]) + RAW[lang] + lines[n].trimStart());
      map.push(n);
    }
    return { text: out.join('\n'), map };
  }
  /* Where line n of the text is in codeView's lines. */
  const codeIndex = (regions, n) => regions.reduce((at, x) => (x.to < n ? at + x.original.length - (x.to - x.from + 1) : at), n);
  /* The text with every region's original code in place of its sentences: where the braces are. */
  function codeView(lines, regions) {
    const out = lines.slice();
    for (const r of [...regions].sort((a, b) => b.from - a.from)) out.splice(r.from, r.to - r.from + 1, ...r.original);
    return out;
  }

  function compileWith(lang, text, W) {
    if (lang === 'python') return W.LANG.compileProject({ sections: [{ id: 'main', file: 'main', text }] }).results.main;
    if (lang === 'cpp' || lang === 'arduino') {
      const id = lang === 'arduino' ? 'sketch' : 'program';
      return W.CPP.compileCppProject({ kind: lang === 'arduino' ? 'arduino' : 'cpp', sections: [{ id, file: id, text }] }).results[id];
    }
    const role = { html: 'structure', css: 'styling', js: 'mechanics' }[lang];
    const sections = ['structure', 'styling', 'mechanics'].map(id => ({ id, file: id, text: id === role ? text : '' }));
    return W.WEB.compileWebsite({ sections }).results[role];
  }

  const NEEDS = /^(?:import\s|from\s+\S+\s+import\s|#include\s)/;
  /* What the standard headers the C++ writer adds give, so a region only brings in the ones it uses. */
  const HEADER_USE = {
    iostream: /std::(?:cout|cin|cerr|endl)\b/, string: /std::(?:string|to_string|getline|stoi|stod)\b/, vector: /std::vector\b/,
    cmath: /std::(?:sqrt|pow|abs|fabs|floor|ceil|round|sin|cos|tan|atan2|log|exp|hypot)\b/, random: /std::(?:mt19937|uniform_\w+|random_device)\b/,
    algorithm: /std::(?:sort|reverse|max|min|find|count|shuffle|clamp)\b/, map: /std::map\b/, cstdlib: /std::(?:exit|rand|srand)\b/,
    thread: /std::this_thread\b/, chrono: /std::chrono\b/, numeric: /std::(?:accumulate|iota)\b/,
  };
  /* Does this code use what the line brings in? import random: random.…; from math import pi: pi; a header: its names. */
  function usedBy(need, body) {
    let m;
    if ((m = need.match(/^import\s+([\w.]+)(?:\s+as\s+(\w+))?$/))) return new RegExp(`\\b${(m[2] || m[1]).replace(/\./g, '\\.')}\\.`).test(body);
    if ((m = need.match(/^from\s+\S+\s+import\s+(.+)$/))) return m[1].split(',').some(n => new RegExp(`\\b${n.trim().split(/\s+as\s+/).pop()}\\b`).test(body));
    if ((m = need.match(/^#include\s+<([\w./]+)>/))) return HEADER_USE[m[1]] ? HEADER_USE[m[1]].test(body) : true;
    return true;
  }

  /* Region i as code, indented to sit where it is, in the file's own indentation. needs: lines the code
     needs at the top of the file that aren't there yet (import random, #include <vector>). */
  function toCode(lang, lines, regions, i, W) {
    const r = regions[i];
    const { text, map } = sentenceFile(lang, lines, regions, i);
    const res = compileWith(lang, text, W);
    const mine = new Set();
    map.forEach((n, s) => { if (n >= r.from && n <= r.to) mine.add(s); });
    const got = res.lines.filter(o => mine.has(o.src));
    const solid = got.filter(o => o.text.trim());
    const low = solid.reduce((m, o) => Math.min(m, width(indentOf(o.text))), Infinity);
    const unit = unitOf(codeView(lines, regions)), per = UNIT[lang];
    const code = got.map(o => {
      if (!o.text.trim()) return '';
      const lv = Math.round((width(indentOf(o.text)) - low) / per);
      return r.base + unit.repeat(Math.max(0, lv)) + o.text.trimStart();
    });
    const have = new Set(lines.map(l => l.trim())), body = code.join('\n');
    const needs = res.lines.filter(o => o.src < 0 && NEEDS.test(o.text.trim()) && !have.has(o.text.trim()) && usedBy(o.text.trim(), body)).map(o => o.text.trim());
    const problems = [];
    map.forEach((n, s) => {
      if (n < r.from || n > r.to) return;
      const inf = res.info[s];
      if (inf && (inf.errs.length || (inf.warns || []).length)) problems.push({ line: n, errs: inf.errs.slice(), warns: (inf.warns || []).slice() });
    });
    return { code, needs, problems };
  }

  const unchanged = (r, lines) => lines.slice(r.from, r.to + 1).join('\n') === r.words.join('\n');

  /* Region i back into code. A region nobody changed gets its original code back, exactly. One with errors
     stays as sentences (ok: false) and says why. */
  function reRegex(lang, lines, regions, i, W) {
    const r = regions[i];
    let code, needs = [], problems = [];
    if (unchanged(r, lines)) code = r.original.slice();
    else {
      ({ code, needs, problems } = toCode(lang, lines, regions, i, W));
      if (problems.some(p => p.errs.length)) return { ok: false, lines, regions, needs: [], problems };
    }
    let out = lines.slice(0, r.from).concat(code, lines.slice(r.to + 1));
    const delta = code.length - (r.to - r.from + 1);
    let rest = regions.filter((_, k) => k !== i).map(x => (x.from > r.to ? { ...x, from: x.from + delta, to: x.to + delta } : x));
    // what it needs at the top: after the imports or includes already there
    if (needs.length) {
      let at = 0;
      for (let n = 0; n < out.length; n++) { if (NEEDS.test(out[n].trim()) && regionAt(rest, n) < 0) at = n + 1; else if (out[n].trim() && !/^(?:#!|"""|'''|#|\/\/)/.test(out[n].trim()) && at) break; }
      out = out.slice(0, at).concat(needs, out.slice(at));
      rest = rest.map(x => (x.from >= at ? { ...x, from: x.from + needs.length, to: x.to + needs.length } : x));
    }
    return { ok: true, lines: out, regions: rest, needs, problems };
  }

  /* ---------- Keeping regions in place while the text is edited ---------- */

  /* Lines the same at the start and the end are the same lines; the regions move with them. Lines typed
     right after (or before) the region the caret was in join it. */
  function adjust(regions, before, after, caretRegion = -1) {
    let p = 0;
    while (p < before.length && p < after.length && before[p] === after[p]) p++;
    let s = 0;
    while (s < before.length - p && s < after.length - p && before[before.length - 1 - s] === after[after.length - 1 - s]) s++;
    const oe = before.length - s - 1, ne = after.length - s - 1, delta = after.length - before.length;
    const out = [];
    regions.forEach((r, k) => {
      let { from, to } = r;
      if (to < p) {
        if (k === caretRegion && to === p - 1 && oe < p && ne >= p) to = ne;   // new lines typed at its end
      } else if (from > oe) {
        if (k === caretRegion && from === oe + 1 && oe < p && ne >= p) to += delta;   // new lines at its start
        else { from += delta; to += delta; }
      } else {
        from = Math.min(from, p);
        to = to > oe ? to + delta : ne;
      }
      if (to >= from) out.push({ ...r, from, to });
    });
    return out;
  }

  root.IntuiUnity = { LANGS, RAW, expand, toWords, toCode, reRegex, adjust, unchanged, unitOf, depths, sentenceFile, codeView };
})(typeof window !== 'undefined' ? window : globalThis);

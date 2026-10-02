/* IntuCode glossary: finds a language's terms in a piece of code, or the less obvious words in a
 * sentence. The terms themselves are plain data in lang/glossary_terms.js:
 *   { t: shown as, m: [strings that count as it], k: kind, s: what it is, eg: example, see: [related t] }
 * Code is read token by token (names, dotted and :: names and their parts, operators); HTML by its tags
 * and attributes; CSS by properties, selectors, units, functions and values; sentences by whole words
 * and phrases outside quotes. Ordinary English words have no entries, on purpose. No DOM.
 */
(function () {
  'use strict';

  const OPS = ['#include', '===', '!==', '...', '::', '->', '=>', '<<', '>>', '==', '!=', '+=', '-=', '*=', '/=', '++', '--', '&&', '||', '**', '//',
    ':', ';', '{', '}', '(', ')', '[', ']', '=', '!', '%', '@', '?', '&', '*', '.'];
  const LISTS = { python: ['python'], cpp: ['cpp'], arduino: ['arduino', 'cpp'], html: ['html'], css: ['css'], js: ['js'], ts: ['js'], say: ['say'] };

  let built = null;
  function terms() { return (typeof window !== 'undefined' && window.IntuiGlossaryTerms) || {}; }
  /* Each list's entries by match string (sentence words in lower case). */
  function indexes() {
    const T = terms();
    if (built && built.src === T) return built;
    built = { src: T, by: {} };
    for (const [lang, list] of Object.entries(T)) {
      const by = new Map();
      for (const e of list) {
        e.lang = lang;
        for (const m of e.m || [e.t]) { const key = lang === 'say' ? m.toLowerCase() : m; if (!by.has(key)) by.set(key, e); }
      }
      built.by[lang] = by;
    }
    return built;
  }

  /* Text without what's inside quotes and comments, so a word in a message isn't taken for a keyword. */
  function strip(text, lang) {
    let t = String(text);
    if (lang === 'python') t = t.replace(/#.*$/gm, '');
    if (lang === 'cpp' || lang === 'arduino' || lang === 'js') t = t.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    if (lang === 'css') t = t.replace(/\/\*[\s\S]*?\*\//g, '');
    if (lang === 'html') t = t.replace(/<!--[\s\S]*?-->/g, '');
    return t.replace(/"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`/g, '""');
  }

  /* The candidate strings in a piece of code, in order. */
  function tokens(lang, text) {
    const out = [];
    const src = String(text);
    if (lang === 'html') {
      if (/<!DOCTYPE/i.test(src)) out.push('<!DOCTYPE html>');
      const t = src.replace(/<!--[\s\S]*?-->/g, '');
      for (const m of t.matchAll(/<\/?([a-zA-Z][\w-]*)|\s([a-zA-Z][\w-]*)\s*=/g)) out.push(m[1] ? `<${m[1].toLowerCase()}>` : `${m[2].toLowerCase()}=`);
      if (/viewport/.test(t)) out.push('viewport');
      return out;
    }
    if (lang === 'css') {
      const t = strip(src, 'css');
      for (const line of t.split('\n')) {
        const decl = line.match(/^\s*(--[\w-]+|[a-z-]+)\s*:\s*([^;{}]*)/);
        if (decl && !/\{/.test(line)) {
          out.push(decl[1].startsWith('--') ? '--' : decl[1] + ':');
          const value = decl[2];
          for (const f of value.matchAll(/([a-z-]+)\(/g)) out.push(f[1] + '()');
          for (const u of value.matchAll(/\d(px|rem|em|%|vh|vw|fr|s|deg)\b/g)) out.push(u[1]);
          if (/%/.test(value)) out.push('%');
          for (const w of value.replace(/[a-z-]+\(/g, ' ').matchAll(/(?<![\w#.-])([a-z][a-z-]*)(?![\w(-])/g)) out.push(w[1]);
          if (/var\(--/.test(value)) out.push('--');
          continue;
        }
        if (/@media/.test(line)) out.push('@media');
        for (const m of line.matchAll(/@([a-z-]+)/g)) out.push('@' + m[1]);
        const sel = line.split('{')[0];
        if (/(^|[\s,>+~])\.[A-Za-z_][\w-]*/.test(sel)) out.push('.class selector');
        if (/(^|[\s,>+~])#[A-Za-z_][\w-]*/.test(sel) && /\{|,\s*$/.test(line)) out.push('#id selector');
        for (const p of sel.matchAll(/::?[a-z-]+/g)) out.push(p[0]);
        for (const p of line.matchAll(/[{};]/g)) out.push(p[0] === ';' ? ';' : '{ }');
      }
      return out;
    }
    // python, C++ (and Arduino), JavaScript
    if (lang === 'python') {
      if (/(^|[^\w])[fF][rR]?["']/.test(src)) out.push('f-string');
      if (/^\s*("""|''')/m.test(src)) out.push('docstring');
      if (/^\s*@/m.test(src)) out.push('decorator');
    }
    if ((lang === 'js' || lang === 'ts') && /`/.test(src)) out.push('template literal');
    const t = strip(src, lang);
    const re = /#include|[A-Za-z_]\w*(?:(?:\.|::)[A-Za-z_]\w*)*|\S/g;
    let m;
    while ((m = re.exec(t))) {
      const w = m[0];
      if (/^[A-Za-z_]/.test(w)) {
        out.push(w);
        if (/[.:]/.test(w)) for (const part of w.split(/\.|::/)) out.push(part);
        continue;
      }
      if (w === '#include') { out.push(w); continue; }
      const op = OPS.find(o => t.startsWith(o, m.index));
      if (op) { out.push(op); re.lastIndex = m.index + op.length; }
    }
    return out;
  }

  /* The terms in a piece of code (lang: python, cpp, arduino, html, css, js), or in sentences (lang 'say',
   * with opts.pack: python, web, cpp or arduino): [entry], each once, in the order they first appear. */
  function find(lang, text, opts = {}) {
    const ix = indexes().by, lists = LISTS[lang] || [lang];
    const seen = new Set(), out = [];
    const add = (e) => { if (e && !seen.has(e)) { seen.add(e); out.push(e); } };
    if (lang === 'say') {
      const by = ix.say;
      if (!by) return out;
      const t = ' ' + String(text).replace(/"(?:[^"\\]|\\.)*"/g, ' ').toLowerCase() + ' ';
      const hits = [];
      for (const [key, e] of by) {
        if (opts.pack && e.packs && !e.packs.includes(opts.pack)) continue;
        const re = new RegExp('(^|[^a-z0-9‹_-])' + key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?=$|[^a-z0-9_-])');
        const m = re.exec(t);
        if (m) hits.push([m.index, -key.length, e]);
      }
      if (/‹[^›]*›/.test(t) && by.get('‹›')) hits.push([t.indexOf('‹'), 0, by.get('‹›')]);   // a ‹blank› to fill in
      hits.sort((a, b) => a[0] - b[0] || a[1] - b[1]).forEach(h => add(h[2]));
      return out;
    }
    for (const tok of tokens(lang, text)) for (const l of lists) { const e = ix[l] && ix[l].get(tok); if (e) { add(e); break; } }
    return out;
  }

  /* An entry by what it's shown as, looked for in a language's lists. */
  function get(lang, t) {
    const T = terms();
    for (const l of LISTS[lang] || [lang]) { const e = (T[l] || []).find(x => x.t === t); if (e) { indexes(); return e; } }
    return null;
  }
  /* Its related entries (from the same list). */
  const related = (e) => (e && e.see ? e.see.map(t => get(e.lang, t)).filter(Boolean) : []);
  /* Every entry a language has, for looking one up by name. */
  const all = (lang) => (LISTS[lang] || [lang]).flatMap(l => terms()[l] || []);

  const api = { find, get, related, all, tokens };
  if (typeof window !== 'undefined') window.IntuiGlossary = api;
})();

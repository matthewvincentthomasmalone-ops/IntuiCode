/* IntuaCode — sentences -> TypeScript (.ts), and React (.tsx, and JSX in JavaScript).
 *
 * Built on the JavaScript writer (lang/web_write.js, compileJs): every Mechanics sentence means here what it
 * means there. This file adds what TypeScript and React have on top, through compileJs's ext hook:
 *   - types where a name is made: set total (a number) to 0, define add using a (a number), b (a number) giving back
 *     a number, constant handle is a tool using e (a React.FormEvent)
 *   - shapes and type names: define shape Note (an interface, its parts indented under it), define type Filter as
 *     "all" or "done", bring in the type Note from "./types"
 *   - shared and main parts of a file (export, export default)
 *   - a value assumed to be a type (as)
 * Exact lines are ts: (or tsx: in a .tsx file), copied as written.
 *
 *   compileTs(sec, shared, { lang: 'ts' | 'tsx' | 'js' }) -> the same result as compileJs: { lines, info, text }
 *   typeTs(words, pos, errs) -> the TypeScript for a type said in words, or null (errs says why)
 *   ext(lang)                -> the ext object compileJs takes (also used by the website's Mechanics, for JSX)
 *
 * No DOM here.
 */
(function (root) {
  'use strict';

  const code = (s) => '`' + s + '`';
  const NAME = String.raw`[A-Za-z_$][\w$]*`;
  const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const note = (inf, s) => { if (inf && !inf.notes.includes(s)) inf.notes.push(s); };
  const err = (inf, s) => { if (inf && !inf.errs.includes(s)) inf.errs.push(s); };

  /* s with quoted text and the insides of brackets hidden (the same length), so separators are found at the top
     level only. "true or false" is one type, so its "or" is hidden too. */
  function mask(s) {
    const q = String(s).replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/g, (m) => '\u0001'.repeat(m.length));
    let out = '', d = 0;
    for (const c of q) { if ('([{'.includes(c)) { out += d ? '\u0001' : c; d++; } else if (')]}'.includes(c)) { d = Math.max(0, d - 1); out += d ? '\u0001' : c; } else out += d ? '\u0001' : c; }
    return out.replace(/\btrue or false\b/g, (m) => 'x'.repeat(m.length));
  }
  /* Split s at a separator found at the top level (re: a global regex run on the masked text). */
  function topSplit(s, re) {
    const m = mask(s), out = [];
    let last = 0;
    for (const x of m.matchAll(re)) { out.push(s.slice(last, x.index)); last = x.index + x[0].length; }
    out.push(s.slice(last));
    return out.map(p => p.trim());
  }
  const topIndex = (s, re) => { const m = re.exec(mask(s)); return m ? { at: m.index, end: m.index + m[0].length } : null; };

  /* ---------- Types in words ---------- */

  const BASIC = { 'a number': 'number', text: 'string', 'true or false': 'boolean', anything: 'any', 'something unknown': 'unknown', 'an object': 'object', undefined: 'undefined' };
  const LIST_OF = { numbers: 'number', text: 'string', 'true or false': 'boolean', anything: 'any' };
  const TYPE_HELP = 'Types are said like: a number, text, true or false, a list of numbers, a list of Note, a Note, text or nothing, "all" or "done", a Promise of nothing, a tool using id (text) giving back nothing.';

  /* The TypeScript for a type said in words. pos: 'ret' (what a tool gives back) or 'promise' (what a promise
     gives): "nothing" there is void; anywhere else it is null. */
  function typeTs(words, pos, errs) {
    const w = String(words).trim();
    const fail = (why) => { if (errs) errs.push(why || `I don't know the type "${w}". ${TYPE_HELP}`); return null; };
    if (!w) return fail('Something is missing here: a type.');
    if (/^a tool\b/.test(w)) {
      const g = topIndex(w, / giving back /);
      if (!g) return fail('Say what the tool gives back, like: a tool using id (text) giving back nothing.');
      const head = w.slice(0, g.at), back = typeTs(w.slice(g.end), 'ret', errs);
      const um = head.match(/^a tool(?:\s+using\s+(.+))?$/);
      if (!um || back == null) return um ? null : fail();
      const ps = um[1] ? topSplit(um[1], /,/g).map(p => paramTs(p, errs)) : [];
      return ps.some(p => p == null) ? null : `(${ps.map(p => p.ts).join(', ')}) => ${back}`;
    }
    const parts = topSplit(w, /,\s+|\s+or\s+/g);
    if (parts.length > 1) {
      const ts = parts.map(p => (p === 'nothing' ? 'null' : typeTs(p, 'union', errs)));
      if (ts.some(t => t == null)) return null;
      if (parts.some(p => /^a tool\b/.test(p))) return fail('A tool can\'t be one of several types here: keep that part as ts: code.');
      return ts.join(' | ');
    }
    if (w === 'nothing') return pos === 'ret' || pos === 'promise' ? 'void' : 'null';
    if (BASIC[w]) return BASIC[w];
    if (/^(["'])[^"'\\\n]*\1$/.test(w) || /^-?\d+(?:\.\d+)?$/.test(w)) return w;
    let m;
    if ((m = w.match(/^a list of (.+)$/))) {
      const item = m[1].trim();
      if (LIST_OF[item]) return LIST_OF[item] + '[]';
      if (new RegExp(`^${NAME}(?:\\.${NAME})*$`).test(item)) return item + '[]';
      return fail(`"${item}" can't be what a list holds here: say a list of numbers, a list of text, or a list of a type's name (a list of Note).`);
    }
    if ((m = w.match(new RegExp(`^an? (${NAME}(?:\\.${NAME})*)(?: of (.+))?$`)))) {
      if (!m[2]) return m[1];
      const args = topSplit(m[2], /\s+and\s+/g).map(a => typeTs(a, m[1] === 'Promise' ? 'promise' : 'arg', errs));
      if (args.some(a => a == null)) return null;
      if (args.length > 2) return fail('A type of three or more types is written as ts: code.');
      return `${m[1]}<${args.join(', ')}>`;
    }
    return fail();
  }

  /* One input of a tool: "id", "id (text)", "name (text, if any)", "count (a number) = 1", "cb (if any)".
     -> { name, ts (its TypeScript), js (as the JavaScript sentence says it), typed } or null. */
  function paramTs(item, errs) {
    const s = String(item).trim();
    const m = s.match(new RegExp(`^(${NAME})\\s*(.*)$`));
    if (!m) { if (errs) errs.push(`"${s}" isn't a name for an input.`); return null; }
    let rest = m[2], inner = null;
    if (rest.startsWith('(')) {
      let d = 0, end = -1;
      for (let k = 0; k < rest.length; k++) { if (rest[k] === '(') d++; else if (rest[k] === ')' && --d === 0) { end = k; break; } }
      if (end < 0) { if (errs) errs.push(`A bracket after ${code(m[1])} isn't closed.`); return null; }
      inner = rest.slice(1, end); rest = rest.slice(end + 1).trim();
    }
    const dm = rest.match(/^=\s*(.+)$/);
    if (rest && !dm) { if (errs) errs.push(`I don't understand "${rest}" after the input ${code(m[1])}.`); return null; }
    let type = null, q = false;
    if (inner != null) {
      const bits = topSplit(inner, /,/g);
      if (bits[bits.length - 1] === 'if any') { q = true; bits.pop(); }
      if (bits.length > 1) { if (errs) errs.push(`Say one type for ${code(m[1])}, in its brackets.`); return null; }
      if (bits.length) { type = typeTs(bits[0], 'arg', errs); if (type == null) return null; }
    }
    if (q && dm) { if (errs) errs.push(`${code(m[1])} has a value for when it's left out, so it can't also be "if any".`); return null; }
    const def = dm ? dm[1].trim() : null;
    return { name: m[1], ts: `${m[1]}${q ? '?' : ''}${type ? ': ' + type : ''}${def != null ? ' = ' + def : ''}`, js: def != null ? `${m[1]} = ${def}` : m[1], typed: inner != null };
  }

  /* ---------- Sentences of their own ---------- */

  const EXPORT_WORD = { shared: 'export ', main: 'export default ' };
  const SPLIT_PARAMS = (s) => topSplit(s, /,/g).filter(Boolean);
  // an input with a type: a bracket straight after its name ("id (text)"); a value in brackets after = is no type
  const TYPED_PARAM = new RegExp(`^${NAME}\\s*\\(`);
  const anyTyped = (list) => SPLIT_PARAMS(list).some(p => TYPED_PARAM.test(p));

  /* What a sentence says as plain JavaScript sentences: { s, export, typed: { kind, …, patch info } }, or null
     when it's one of them already. */
  function plainOf(s, typed, errs) {
    let m, exp = null, t = s;
    if ((m = t.match(/^define (shared|main) (.+)$/i)) && !/^(?:shape|type)\b/i.test(m[2])) { exp = m[1].toLowerCase(); t = 'define ' + m[2]; }
    else if ((m = t.match(/^shared (constant .+)$/i))) { exp = 'shared'; t = m[1]; }
    let kind = null, info = {};
    // "set total (a number) to 0", "constant name (text) is "x"": the type runs to the bracket that closes the one after the name
    const vm = t.match(new RegExp(`^(set|let|make|constant) (${NAME}) \\(`, 'i'));
    const close = vm ? closeOf(t, vm[0].length - 1) : -1;
    const after = close > 0 ? t.slice(close + 1).match(/^ (to|be|is) (.+)$/i) : null;
    if (typed && after && (/^constant$/i.test(vm[1]) ? /^is$/i.test(after[1]) : !/^is$/i.test(after[1]))) {
      kind = 'value'; info = { name: vm[2], type: t.slice(vm[0].length, close) };
      t = `${vm[1]} ${vm[2]} ${after[1]} ${after[2]}`;
    } else if ((m = t.match(new RegExp(`^define (${NAME})(?: using (.+?))?(?: giving back (.+))?$`, 'i'))) && !/^(?:shape|type|class|component)$/i.test(m[1])) {
      const g = topIndex(t, / giving back /);
      const head = g ? t.slice(0, g.at) : t, back = g ? t.slice(g.end) : null;
      const hm = head.match(new RegExp(`^define (${NAME})(?: using (.+))?$`, 'i'));
      if (hm && (back != null || anyTyped(hm[2] || ''))) {
        if (!typed) { errs.push('Types are TypeScript: a JavaScript file has none. Leave out the brackets and "giving back …".'); }
        const ps = hm[2] ? SPLIT_PARAMS(hm[2]).map(p => paramTs(p, errs)) : [];
        if (ps.some(p => p == null)) return { s: `define ${hm[1]}`, exp, kind: 'bad' };
        kind = 'fn'; info = { name: hm[1], ps, back };
        t = `define ${hm[1]}${ps.length ? ' using ' + ps.map(p => p.js).join(', ') : ''}`;
      }
    } else if ((m = t.match(new RegExp(`^(constant|set) (${NAME}) (is|to) a tool using (.+)$`, 'i')))) {
      const g = topIndex(m[4], / giving back /);
      const list = g ? m[4].slice(0, g.at) : m[4], body = g ? m[4].slice(g.end) : null;
      if (anyTyped(list)) {
        if (!typed) errs.push('Types are TypeScript: a JavaScript file has none. Leave out the brackets.');
        const ps = SPLIT_PARAMS(list).map(p => paramTs(p, errs));
        if (ps.some(p => p == null)) return { s: `${m[1]} ${m[2]} ${m[3]} a tool`, exp, kind: 'bad' };
        kind = 'tool'; info = { name: m[2], ps };
        t = `${m[1]} ${m[2]} ${m[3]} a tool using ${ps.map(p => p.js).join(', ')}${body != null ? ' giving back ' + body : ''}`;
      }
    }
    if (!exp && !kind) return null;
    return { s: t, exp, kind, ...info };
  }
  /* Where the bracket opening at s[at] closes, or -1. */
  function closeOf(s, at) {
    let d = 0, q = null;
    for (let k = at; k < s.length; k++) {
      const c = s[k];
      if (q) { if (c === '\\') k++; else if (c === q) q = null; continue; }
      if (c === '"' || c === "'") q = c;
      else if (c === '(') d++;
      else if (c === ')' && --d === 0) return k;
    }
    return -1;
  }

  /* The lines indented under line i (blank lines inside included): the last one's index. */
  function blockEnd(lines, i) {
    const ind = lines[i].match(/^ */)[0].length;
    let j = i;
    for (let k = i + 1; k < lines.length; k++) {
      if (!lines[k].trim()) continue;
      if (lines[k].match(/^ */)[0].length <= ind) break;
      j = k;
    }
    return j;
  }

  function ext(lang) {
    const typed = lang !== 'js';

    // (shapes, type names and "share …" make no name a sentence uses as a value)
    const OWN = /^(?:define (?:shared )?(?:shape|type) |bring in the types? |share )/i;
    const plain = (s) => { const t = String(s).replace(/[.:]$/, ''); if (OWN.test(t)) return ''; const p = plainOf(t, typed, []); return p ? p.s : null; };

    /* The parts of a shape: "id is text", "read-only created is a Date", "email is text, if any". */
    function shapeBody(c, from, to) {
      for (let k = from; k <= to; k++) {
        const raw = c.lines[k], inf = c.info[k], t = raw.trim().replace(/[.;]$/, '');
        if (!t) { c.push('', k); continue; }
        const pad = c.pad + '  ';
        let m;
        if ((m = raw.match(/^\s*(?:js|javascript|raw)\s*:\s?(.*)$/i))) { note(inf, 'Raw TypeScript: copied exactly as written.'); c.push(pad + m[1], k); continue; }
        if ((m = t.match(/^(?:note|comment)\s*:\s*(.*)$/i))) { c.push(pad + '// ' + m[1], k); continue; }
        if ((m = t.match(new RegExp(`^(read-only\\s+)?(${NAME})\\s+is\\s+(.+?)(,\\s*if any)?$`, 'i')))) {
          const errs = [];
          const ts = typeTs(m[3], 'arg', errs);
          errs.forEach(e => err(inf, e));
          note(inf, `${code(m[2])} is one part of the shape: ${m[1] ? '`readonly` means it can\'t be changed once set; ' : ''}${m[4] ? '`?` means it can be left out; ' : ''}its type comes after the colon.`);
          c.push(`${pad}${m[1] ? 'readonly ' : ''}${m[2]}${m[4] ? '?' : ''}: ${ts == null ? 'unknown' : ts};`, k);
          continue;
        }
        err(inf, 'Each part of a shape is one line, like: id is text (or "read-only id is text", "email is text, if any").');
        c.push(pad + '// ??? ' + t, k);
      }
    }

    function line(s, c) {
      const errs = [];
      let m;
      // shapes: "define shape Note", "define shared shape Note based on Base", parts indented under it
      if (typed && (m = s.match(new RegExp(`^define (?:(shared) )?shape (${NAME})(?: based on (.+))?$`, 'i')))) {
        const bases = m[3] ? topSplit(m[3], /,\s*|\s+and\s+/g) : [];
        if (bases.some(b => !new RegExp(`^${NAME}(?:\\.${NAME})*$`).test(b))) err(c.inf, 'Name the shapes it is based on, like: define shape Admin based on User and Staff.');
        if (c.stack.length) err(c.inf, 'A shape is defined at the left edge, not inside a block.');
        const j = blockEnd(c.lines, c.i);
        note(c.inf, `\`interface\` describes the shape of an object: the parts it has and the type of each. TypeScript checks every ${m[2]} has them.` + (bases.length ? ` \`extends\` gives it every part of ${bases.map(code).join(' and ')} too.` : ''));
        const head = `${m[1] ? 'export ' : ''}interface ${m[2]}${bases.length ? ' extends ' + bases.join(', ') : ''} {`;
        if (j === c.i) { c.say(head + '}'); return true; }
        c.say(head); shapeBody(c, c.i + 1, j); c.push(c.pad + '}', c.i);
        c.skip(j);
        return true;
      }
      // type names: "define type Filter as "all" or "done"", "define type Props as a shape" (its parts under it)
      if (typed && (m = s.match(new RegExp(`^define (?:(shared) )?type (${NAME}) as (.+)$`, 'i')))) {
        const exp = m[1] ? 'export ' : '';
        if (c.stack.length) err(c.inf, 'A type is defined at the left edge, not inside a block.');
        if (/^a shape$/i.test(m[3].trim())) {
          const j = blockEnd(c.lines, c.i);
          note(c.inf, '`type … = { … }` names the shape of an object: the parts it has and the type of each.');
          if (j === c.i) { c.say(`${exp}type ${m[2]} = {};`); return true; }
          c.say(`${exp}type ${m[2]} = {`); shapeBody(c, c.i + 1, j); c.push(c.pad + '};', c.i);
          c.skip(j);
          return true;
        }
        const ts = typeTs(m[3], 'arg', errs);
        errs.forEach(e => err(c.inf, e));
        note(c.inf, `\`type\` gives a type a name of its own: ${code(m[2])} means ${code(ts || '…')} wherever it is used.`);
        c.say(`${exp}type ${m[2]} = ${ts == null ? 'unknown' : ts};`);
        return true;
      }
      // other files: "bring in "./index.css"", "bring in everything from "react" as React", "bring in App (the main part)
      // from "./App"", "bring in Toaster as Sonner from …", "bring in clsx and the type ClassValue from "clsx""
      const FROM = String.raw`("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')`;
      if ((m = s.match(new RegExp(`^bring in ${FROM}$`, 'i')))) {
        if (c.stack.length) err(c.inf, '"bring in" goes at the left edge, near the top.');
        note(c.inf, '`import "…"` loads the file for what it does (a style sheet, say), without taking any names from it.');
        c.say(`import ${m[1]};`);
        return true;
      }
      if ((m = s.match(new RegExp(`^bring in everything from ${FROM} as (${NAME})$`, 'i')))) {
        if (c.stack.length) err(c.inf, '"bring in" goes at the left edge, near the top.');
        note(c.inf, `\`import * as ${m[2]}\` brings in everything the file shares, as the parts of ${code(m[2])}: ${m[2]}.something.`);
        c.declare(m[2], 'const');
        c.say(`import * as ${m[2]} from ${m[1]};`);
        return true;
      }
      if ((m = s.match(new RegExp(`^bring in\\s+(.+?)\\s+from\\s+${FROM}$`, 'i'))) && /\(the main part\)|\sas\s|^the type\s|\sthe type\s/i.test(m[1]) && !/^the types?\s(?!.*\sthe type\s)/i.test(m[1])) {
        const items = topSplit(m[1], /,\s*|\s+and\s+/g);
        let main = null;
        const named = [];
        items.forEach((it, k) => {
          let q;
          if (k === 0 && (q = it.match(new RegExp(`^(${NAME}) \\(the main part\\)$`, 'i')))) main = q[1];
          else if ((q = it.match(new RegExp(`^(the type )?(${NAME})(?: as (${NAME}))?$`, 'i')))) {
            if (q[1] && !typed) err(c.inf, 'Types are TypeScript: a JavaScript file brings in none.');
            named.push(`${q[1] ? 'type ' : ''}${q[2]}${q[3] ? ' as ' + q[3] : ''}`);
            if (!q[1]) c.declare(q[3] || q[2], 'const');
          } else err(c.inf, `I don't understand "${it}" here. Name each thing to bring in: a name, "a as b", "the type Note", or first "App (the main part)".`);
        });
        if (main) c.declare(main, 'const');
        if (c.stack.length) err(c.inf, '"bring in" goes at the left edge, near the top.');
        note(c.inf, (main ? `\`import ${main}\` brings in the file's main part (what it shares with \`export default\`), named ${code(main)} here. ` : '') + (named.some(n => / as /.test(n)) ? '`as` gives a name another name here. ' : '') + (named.some(n => /^type /.test(n)) ? '`type` brings in a type only. ' : '') + '`{ … }` brings in what it shares by name.');
        c.say(`import ${main || ''}${main && named.length ? ', ' : ''}${named.length ? `{ ${named.join(', ')} }` : ''} from ${m[2]};`);
        return true;
      }
      if (typed && (m = s.match(/^bring in the types?\s+(.+?)\s+from\s+("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')$/i))) {
        const names = topSplit(m[1], /,\s*|\s+and\s+/g);
        if (names.some(n => !new RegExp(`^${NAME}$`).test(n))) err(c.inf, 'Name each type to bring in, like: bring in the types Note and Tag from "./types".');
        if (c.stack.length) err(c.inf, '"bring in" goes at the left edge, near the top.');
        note(c.inf, '`import type` brings in only types: they are used for checking, and nothing of them is left when the program runs.');
        c.say(`import type { ${names.join(', ')} } from ${m[2]};`);
        return true;
      }
      // the file's shared parts: "share App as the main part", "share a and b"
      if ((m = s.match(new RegExp(`^share (${NAME}) as (?:the|its|this file's|the file's) main part$`, 'i')))) {
        note(c.inf, '`export default` makes this the file\'s main part: another file brings it in by any name it likes.');
        c.say(`export default ${m[1]};`);
        return true;
      }
      if ((m = s.match(/^share\s+(.+)$/i)) && !/\bas\b/i.test(m[1])) {
        const names = topSplit(m[1], /,\s*|\s+and\s+/g);
        if (names.every(n => new RegExp(`^${NAME}$`).test(n))) {
          note(c.inf, '`export` shares these with other files, which bring them in by name.');
          c.say(`export { ${names.join(', ')} };`);
          return true;
        }
      }
      // types where names are made, and shared parts: said as the JavaScript sentence, then the code made is changed
      const p = plainOf(s, typed, errs);
      errs.forEach(e => err(c.inf, e));
      if (!p) return false;
      const inf = c.inf, exp = p.exp ? EXPORT_WORD[p.exp] : '';
      if (p.exp && c.stack.length) err(inf, p.exp === 'main' ? 'The main part of a file is made at the left edge.' : 'A shared part is made at the left edge, not inside a block.');
      if (p.exp) note(inf, p.exp === 'main' ? '`export default` makes this the file\'s main part: another file brings it in by any name it likes.' : '`export` shares it: other files can bring it in by name.');
      let typedTs = null;
      if (p.kind === 'value') { typedTs = typeTs(p.type, 'arg', errs); errs.forEach(e => err(inf, e)); if (typedTs != null) note(inf, `${code(p.name)} is ${code(typedTs)}: TypeScript checks that only that kind of value is ever stored in it.`); }
      if (p.kind === 'fn' && p.back != null) { typedTs = typeTs(p.back, 'ret', errs); errs.forEach(e => err(inf, e)); }
      if (p.kind === 'fn' || p.kind === 'tool') note(inf, 'Each input\'s type comes after its name and a colon; `?` means it can be left out.' + (p.back != null ? ' The type after the brackets is what the tool gives back.' : ''));
      return {
        s: p.s,
        patch: (out, at) => {
          const o = out[at];
          if (!o) return;
          const pad = o.text.match(/^ */)[0];
          let t = o.text.slice(pad.length), ok = true;
          if (p.kind === 'value' && typedTs != null) {
            const re = new RegExp(`^((?:let|const) ${esc(p.name)})( = )`);
            if (re.test(t)) t = t.replace(re, `$1: ${typedTs}$2`);
            else { ok = false; err(inf, `${code(p.name)} already exists here, so it can't be given a type again: its type is said where it is first made.`); }
          }
          if (p.kind === 'fn') {
            const was = `${p.name}(${p.ps.map(q => q.js).join(', ')}) {`;
            if (t.endsWith(was)) t = t.slice(0, -was.length) + `${p.name}(${p.ps.map(q => q.ts).join(', ')})${p.back != null ? `: ${typedTs == null ? 'unknown' : typedTs}` : ''} {`;
            else ok = false;
          }
          if (p.kind === 'tool') {
            const was = `(${p.ps.map(q => q.js).join(', ')}) =>`, k = t.indexOf(was);
            if (k >= 0) t = t.slice(0, k) + `(${p.ps.map(q => q.ts).join(', ')}) =>` + t.slice(k + was.length);
            else ok = false;
          }
          if (!ok && p.kind !== 'value') err(inf, 'The types couldn\'t be put in the code this sentence makes. Write the line as ts: code.');
          o.text = pad + exp + t;
        },
      };
    }

    /* "data assumed to be a list of Note": as */
    function expr(s, x, inf, E) {
      if (!typed) return null;
      // "el for sure": el!, TypeScript is told it is there (not null or undefined)
      if (/\sfor sure$/.test(mask(s)) && !topIndex(s, / assumed to be /)) {
        const v = E(s.slice(0, -' for sure'.length));
        note(inf, '`!` tells TypeScript the value is there for sure (not null or undefined). It changes nothing when the program runs: if it is missing after all, the next step fails.');
        return /^[\w$.]+(?:\([^()]*\)|\[[^\]]*\])*$/.test(v) ? `${v}!` : `(${v})!`;
      }
      const at = topIndex(s, / assumed to be /);
      if (!at) return null;
      const errs = [], ts = typeTs(s.slice(at.end), 'arg', errs);
      errs.forEach(e => err(inf, e));
      note(inf, '`as` tells TypeScript to treat the value as that type. It changes nothing when the program runs, and TypeScript trusts it: if the value isn\'t that type, nothing warns you.');
      const v = E(s.slice(0, at.at));
      return `${/^[\w$.]+$|^\(.*\)$/.test(v) ? v : `(${v})`} as ${ts == null ? 'unknown' : ts}`;
    }

    /* Pass 1: the names its own sentences make (what "bring in" brings in). */
    function names(s, x) {
      const t = String(s).trim().replace(/[.:]$/, '');
      let m;
      if ((m = t.match(new RegExp(`^bring in everything from .+ as (${NAME})$`, 'i')))) x.vars.add(m[1]);
      else if ((m = t.match(/^bring in\s+(.+?)\s+from\s+["']/i)) && !/^the types?\s/i.test(m[1])) {
        for (const it of topSplit(m[1], /,\s*|\s+and\s+/g)) {
          const q = it.match(new RegExp(`^(?:(${NAME}) \\(the main part\\)|(${NAME})(?: as (${NAME}))?)$`, 'i'));
          if (q) x.vars.add(q[1] || q[3] || q[2]);
        }
      }
    }

    return { plain, names, line, expr };
  }

  const freshShared = () => ({ ids: {}, groups: {}, cssGroups: {}, addGroups: {} });
  const EXTS = {};
  const extFor = (lang) => (EXTS[lang] = EXTS[lang] || ext(lang));

  function compileTs(sec, shared, opts = {}) {
    const lang = opts.lang || 'ts';
    // exact lines (ts: / tsx:) are given to the JavaScript writer as its own exact lines, which it copies as written
    const RAW = lang === 'tsx' ? /^(\s*)(?:tsx|ts)\s*:/i : lang === 'ts' ? /^(\s*)ts\s*:/i : null;
    const text = RAW ? String(sec.text).split('\n').map(l => l.replace(RAW, '$1js:')).join('\n') : String(sec.text);
    const r = root.IntuiWeb.compileJs({ ...sec, text }, shared || freshShared(), extFor(lang));
    if (lang !== 'js') for (const inf of r.info) inf.notes = inf.notes.map(n => (n === 'Raw JavaScript: copied exactly as written.' ? 'Raw TypeScript: copied exactly as written.' : n));
    return r;
  }

  root.IntuiTs = { compileTs, typeTs, paramTs, ext: extFor };
})(typeof window !== 'undefined' ? window : globalThis);

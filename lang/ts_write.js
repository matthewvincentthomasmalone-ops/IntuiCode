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
    let type = null, q = false, more = false;
    if (inner != null) {
      const bits = topSplit(inner, /,/g);
      if (bits[0] === 'the rest') { more = true; bits.shift(); }   // ...inputs: all the inputs given from here on, as a list
      if (bits[bits.length - 1] === 'if any') { q = true; bits.pop(); }
      if (bits.length > 1) { if (errs) errs.push(`Say one type for ${code(m[1])}, in its brackets.`); return null; }
      if (bits.length) { type = typeTs(bits[0], 'arg', errs); if (type == null) return null; }
    }
    if (q && dm) { if (errs) errs.push(`${code(m[1])} has a value for when it's left out, so it can't also be "if any".`); return null; }
    const def = dm ? dm[1].trim() : null;
    if (more && (q || def != null)) { if (errs) errs.push(`${code(m[1])} takes the rest of the inputs, so it can't be "if any" or have a value of its own.`); return null; }
    const dots = more ? '...' : '';
    // (js: the input as the JavaScript sentence names it, which the types then replace in the code it makes)
    return { name: m[1], ts: `${dots}${m[1]}${q ? '?' : ''}${type ? ': ' + type : ''}${def != null ? ' = ' + def : ''}`, js: def != null ? `${m[1]} = ${def}` : m[1], typed: inner != null };
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
    // React's sentences make no names these sentences learn their own way (see names)
    // (not JavaScript's "keep track of the keys" or "take x out of group y")
    const REACT_OWN = /^(?:define (?:shared |main )?component |(?:shared )?constant \S+ is a component\b|keep (?!track of )|show(?:$|:\s)|when \S+ (?:first appears|goes away)|whenever |change \S+ (?:to|from) |take (?!.+ out of group ))/i;
    const plain = (s) => {
      const t = String(s).replace(/[.:]$/, '');
      if (OWN.test(t) || REACT_OWN.test(t)) return '';
      const memo = t.match(/^(.+?), worked out (?:again whenever .+ changes|once)$/i);
      if (memo) return memo[1];
      const p = plainOf(t, typed, []);
      return p ? p.s : null;
    };

    /* The parts of a shape: "id is text", "read-only created is a Date", "email is text, if any". */
    function shapeBody(c, from, to) {
      for (let k = from; k <= to; k++) {
        const raw = c.lines[k], inf = c.info[k], t = raw.trim().replace(/[.;]$/, '');
        if (!t) { c.push('', k); continue; }
        const pad = c.pad + '  ';
        let m;
        if ((m = raw.match(/^\s*(?:js|javascript|raw)\s*:\s?(.*)$/i))) { note(inf, 'Raw TypeScript: copied exactly as written.'); c.push(pad + m[1], k); continue; }
        if ((m = raw.trim().match(/^(?:note|comment)\s*:\s*(.*)$/i))) { c.push(pad + '// ' + m[1], k); continue; }
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

    /* ---------- Phrase packs as values: Supabase queries, TanStack Query ---------- */

    const Q = String.raw`(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')`;
    let linedInf = null;   // the info of the line whose query goes on over the line under it (see queryOnLines)
    let linedChain = null;   // … whose Supabase query has its parts on the lines under it, a call a line (see chainOnLines)
    const SUPA =new RegExp(String.raw`^(every row of|the (${Q}) of every row of|adding (.+?) to|changing (.+?) in|adding or replacing (.+?) in|deleting from) the (${Q}) table in (${NAME})((?: .*)?)$`, 'i');
    const SUPA_NEXT = / (?:where|sorted by|at most)\s| (?:giving back the result|as a single row|as one row or none)(?=$| )/i;
    // one part of a query after its table, on a line of its own
    const SUPA_PART = new RegExp(String.raw`^(?:where ${Q} is(?: not)? \S.*|sorted by ${Q}(?: from the end| from the start)?|at most \d+|giving back the result|as a single row|as one row or none)$`, 'i');
    function packValue(s, inf, E) {
      let m;
      if (s === LINED && lined && inf === lined.inf) return lined.code(E);
      if ((m = s.match(SUPA))) {
        const [, head, cols, ins, upd, ups, table, client, mods] = m;
        const calls = [`from(${table})`];
        if (/^every row of$/i.test(head)) calls.push('select("*")');
        else if (cols) calls.push(`select(${cols})`);
        else if (ins != null) calls.push(`insert(${E(ins)})`);
        else if (upd != null) calls.push(`update(${E(upd)})`);
        else if (ups != null) calls.push(`upsert(${E(ups)})`);
        else calls.push('delete()');
        let rest = mods || '';
        const until = (r) => { const at = mask(r).search(SUPA_NEXT); return at < 0 ? r.length : at; };
        for (let guard = 0; rest.trim() && guard < 20; guard++) {
          let mm;
          if ((mm = rest.match(new RegExp(`^ where (${Q}) is( not)? `, 'i')))) { rest = rest.slice(mm[0].length); const end = until(rest); calls.push(`${mm[2] ? 'neq' : 'eq'}(${mm[1]}, ${E(rest.slice(0, end))})`); rest = rest.slice(end); continue; }
          if ((mm = rest.match(new RegExp(`^ sorted by (${Q})( from the end| from the start)?`, 'i')))) { calls.push(`order(${mm[1]}${mm[2] ? `, { ascending: ${/end/i.test(mm[2]) ? 'false' : 'true'} }` : ''})`); rest = rest.slice(mm[0].length); continue; }
          if ((mm = rest.match(/^ at most (\d+)/i))) { calls.push(`limit(${mm[1]})`); rest = rest.slice(mm[0].length); continue; }
          if ((mm = rest.match(/^ giving back the result/i))) { calls.push('select()'); rest = rest.slice(mm[0].length); continue; }
          if ((mm = rest.match(/^ as a single row/i))) { calls.push('single()'); rest = rest.slice(mm[0].length); continue; }
          if ((mm = rest.match(/^ as one row or none/i))) { calls.push('maybeSingle()'); rest = rest.slice(mm[0].length); continue; }
          err(inf, `I don't understand "${rest.trim()}" in this query. After the table: where "id" is id, sorted by "created_at" (from the end), at most 10, giving back the result, as a single row.`);
          break;
        }
        const js = client + calls.map(x => '.' + x).join('');
        note(inf, `A Supabase query: ${code(js.length > 90 ? js.slice(0, 87) + '…' : js)}. It asks the database and gives back { data, error } once it answers (so it is waited for).`);
        // (its parts on the lines under the sentence: a call a line, one step in)
        return inf && inf === linedChain ? client + calls.map(x => '\n  .' + x).join('') : js;
      }
      const lb = topIndex(s, / loaded by /);
      if ((m = s.match(/^the query (.+) loaded by (.+)$/i)) && lb) {
        note(inf, '`useQuery` loads data and keeps it: the query key names it (so it is loaded once and shared), the function loads it.');
        const key = E(s.slice('the query '.length, lb.at)), fn = E(s.slice(lb.end));
        // "loaded by …" on the line under it: one part per line, as the sentences have it
        return inf && inf === linedInf ? `useQuery({\n  queryKey: ${key},\n  queryFn: ${fn},\n})` : `useQuery({ queryKey: ${key}, queryFn: ${fn} })`;
      }
      if ((m = s.match(/^a change made by (.+)$/i))) {
        note(inf, '`useMutation` makes a change (saving, deleting…) the page can run with `.mutate(…)`.');
        return `useMutation({ mutationFn: ${E(m[1])} })`;
      }
      return null;
    }

    /* ---------- React ---------- */

    const states = new Map();   // count -> setCount, from the "keep" sentences (pass 1)
    const WEB = () => root.IntuiWeb;
    const PROPS_HELP = 'Name the props after "using", like: define component Card using title and children (and "from CardProps" for their shape).';

    /* "title, saving = false and children" -> { names, code: '{ title, saving = false, children }' } */
    function propsCode(list, inf) {
      const items = topSplit(list, /,\s*|\s+and\s+/g).filter(Boolean);
      const names = [], code = [];
      for (const it of items) {
        const m = it.match(new RegExp(`^(${NAME})(?:\\s*=\\s*(.+))?$`));
        if (!m) { err(inf, `"${it}" isn't a prop's name. ${PROPS_HELP}`); continue; }
        names.push(m[1]); code.push(m[2] != null ? `${m[1]} = ${m[2].trim()}` : m[1]);
      }
      return { names, code: `{ ${code.join(', ')} }` };
    }
    /* A component's head: "define [shared |main ]component Card [using … ][from Props]", or the arrow kind,
       "[shared ]constant Card is a component [using …][ from Props][, showing]". */
    function componentHead(s) {
      let m = s.match(new RegExp(`^define (?:(shared|main) )?component (${NAME})(.*)$`, 'i')), arrow = false;
      if (!m) { m = s.match(new RegExp(`^(?:(shared) )?constant (${NAME}) is a component(.*)$`, 'i')); arrow = true; }
      if (!m) return null;
      let rest = m[3], showing = false, type = null, list = null, one = null;
      // ", showing:" with what it shows under it, or after it on the same line (", showing: a paragraph saying "Hi"")
      const sh = arrow ? topIndex(rest, /,\s*showing(?::\s*|$)/i) : null;
      if (sh) { showing = true; one = rest.slice(sh.end).trim() || null; rest = rest.slice(0, sh.at); }
      const from = topIndex(rest, /\s+from\s+(?=\S+$)/);
      if (from) { type = rest.slice(from.end).trim(); rest = rest.slice(0, from.at); }
      const u = rest.match(/^\s+using\s+(.+)$/i);
      if (u) list = u[1]; else if (rest.trim()) return { bad: `I don't understand "${rest.trim()}" here. ${PROPS_HELP}` };
      return { exp: m[1] ? m[1].toLowerCase() : null, name: m[2], arrow, showing, one, type, list };
    }

    /* The words for an event -> the prop's name: clicked -> onClick, "checked changes" -> onCheckedChange. */
    const EVENT_PROP = { clicked: 'onClick', 'double-clicked': 'onDoubleClick', changed: 'onChange', 'typed in': 'onInput', sent: 'onSubmit', focused: 'onFocus', unfocused: 'onBlur', hovered: 'onMouseEnter', 'a key is pressed': 'onKeyDown', 'a key is released': 'onKeyUp', scrolled: 'onScroll' };
    const eventProp = (w) => { const t = w.trim().toLowerCase(); if (EVENT_PROP[t]) return EVENT_PROP[t]; const m = t.match(/^([a-z]+(?: [a-z]+)*) changes$/); return m ? 'on' + m[1].split(' ').map(x => x[0].toUpperCase() + x.slice(1)).join('') + 'Change' : null; };

    /* One step written in place (a handler, a clean-up): change a state, show, run a tool -> its code, or null. */
    function stepCode(t, c, inf, given) {
      const E = (v) => c.E(v);
      const withName = (n, fn) => { const had = c.x.vars.has(n); c.x.vars.add(n); try { return fn(); } finally { if (!had) c.x.vars.delete(n); } };
      const run = () => {
        let m;
        if ((m = t.match(new RegExp(`^change (${NAME}) from (${NAME}) to (.+)$`, 'i')))) {
          const set = states.get(m[1]);
          if (!set) { err(inf, `${code(m[1])} isn't a state kept here ("keep ${m[1]}, starting at …"), so it can't be changed this way.`); return null; }
          note(inf, `${code(set)} with a little tool: React gives it the current ${m[1]} (here ${code(m[2])}), and keeps what it gives back.`);
          return withName(m[2], () => `${set}((${m[2]}) => ${E(m[3])})`);
        }
        if ((m = t.match(new RegExp(`^change (${NAME}) to (.+)$`, 'i')))) {
          const set = states.get(m[1]);
          if (!set) { err(inf, `${code(m[1])} isn't a state kept here ("keep ${m[1]}, starting at …"), so it can't be changed this way.`); return null; }
          note(inf, `${code(set)} changes ${code(m[1])}: React then shows the component again with the new value.`);
          return `${set}(${E(m[2])})`;
        }
        if ((m = t.match(/^show\s+(.+)$/i))) return `console.log(${WEB().splitAnd(m[1]).map(E).join(', ')})`;
        if ((m = t.match(new RegExp(`^mark the query (.+) in (${NAME}(?:\\.${NAME})*) as out of date$`, 'i')))) {
          note(inf, '`invalidateQueries` marks the query as out of date, so TanStack Query loads it again (and the page shows the new data).');
          return `${m[2]}.invalidateQueries({ queryKey: ${E(m[1])} })`;
        }
        if ((m = t.match(new RegExp(`^run (${NAME}(?:\\.${NAME})*)(?:\\s+with\\s+(.+))?$`, 'i')))) return `${m[1]}(${m[2] ? WEB().splitAnd(m[2]).map(E).join(', ') : ''})`;
        err(inf, 'A step written here is one of: change ‹state› to …, run ‹tool› with …, show ….');
        return null;
      };
      return given ? withName(given, run) : run();
    }

    /* The lines under a line (from..to) as a tree, by indentation. */
    function treeOf(c, from, to) {
      const root = { kids: [], ind: -1 }, st = [root];
      for (let k = from; k <= to; k++) {
        const raw = c.lines[k];
        if (!raw.trim()) continue;
        const ind = raw.match(/^ */)[0].length;
        while (st.length > 1 && ind <= st[st.length - 1].ind) st.pop();
        const n = { k, ind, raw, t: raw.trim(), kids: [] };
        st[st.length - 1].kids.push(n);
        st.push(n);
      }
      return root.kids;
    }

    /* A quoted run, "Hi {name}!" -> [{ text } | { fill }]. */
    function runPieces(q) {
      const d = q[0], body = q.slice(1, -1), out = [];
      let text = '';
      for (let k = 0; k < body.length; k++) {
        const ch = body[k];
        if (ch === '\\' && k + 1 < body.length) { text += body[++k]; continue; }
        if ((ch === '{' || ch === '}') && body[k + 1] === ch) { text += ch; k++; continue; }
        if (ch === '{') {
          let depth = 0, end = -1, qq = null;
          for (let j = k; j < body.length; j++) {
            const cj = body[j];
            if (qq) { if (cj === '\\') j++; else if (cj === qq) qq = null; continue; }
            if (cj === '"' || cj === "'") qq = cj;
            else if (cj === '{') depth++;
            else if (cj === '}' && --depth === 0) { end = j; break; }
          }
          if (end < 0) return null;
          if (text) out.push({ text }); text = '';
          out.push({ fill: body.slice(k + 1, end) });
          k = end; continue;
        }
        text += ch;
      }
      if (text) out.push({ text });
      return d === '"' || d === "'" ? out : null;
    }
    const QUOTED = /^(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')$/;
    // text as JSX writes it: the characters JSX would read as something else written as character references
    const jsxTextOf = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\{/g, '&#123;').replace(/\}/g, '&#125;');
    // a value in braces at the start of s: "{a, b} rest" -> { inner: 'a, b', rest: ' rest' }
    function braced(s) {
      if (s[0] !== '{') return null;
      let depth = 0, q = null;
      for (let j = 0; j < s.length; j++) {
        const cj = s[j];
        if (q) { if (cj === '\\') j++; else if (cj === q) q = null; continue; }
        if (cj === '"' || cj === "'" || cj === '`') q = cj;
        else if (cj === '{') depth++;
        else if (cj === '}' && --depth === 0) return { inner: s.slice(1, j), rest: s.slice(j + 1) };
      }
      return null;
    }

    /* JSX from the sentences under "show:": [{ text, src }] at level 0, with c.E for values in context. */
    function jsx(c, nodes) {
      const out = [];
      // (a line inside a template literal, `…` over several lines, is its text: it keeps its own spaces, keep: true)
      let ticks = 0;
      const ind = (o) => (o.keep ? o : { ...o, d: (o.d || 0) + 1 });   // (one step further in: d, the depth, is turned into spaces at the end)
      // one node as lines, or as one line (inline) when it can be
      const render = (n, level) => {
        const inf = c.info[n.k], t = n.t.replace(/[.]$/, '');
        let m;
        const E = (v) => c.E(v);
        const block = (code, extra) => [{ text: code, src: n.k, ...extra }];
        if ((m = n.raw.match(/^\s*(?:js|javascript|raw)\s*:\s?(.*)$/i))) {
          note(inf, 'Raw TSX: copied exactly as written.');
          const keep = ticks % 2 === 1;
          ticks += (m[1].replace(/\\./g, '').match(/`/g) || []).length;
          return [{ text: m[1], src: n.k, raw: true, keep }, ...n.kids.flatMap(k => render(k, level))];
        }
        if ((m = n.t.match(/^(?:note|comment)\s*:\s*(.*)$/i))) return block(`{/* ${m[1]} */}`);
        if (/^a space$/i.test(t)) { note(inf, '`{" "}` is a space JSX keeps (a space at the end of a line in JSX is left out).'); return block('{" "}'); }
        if (QUOTED.test(t)) {
          const ps = runPieces(t);
          if (!ps) { err(inf, 'A { in this text isn\'t closed. A brace itself is written twice: {{ or }}.'); return block(''); }
          return [{ text: ps.map(p => (p.fill != null ? `{${E(p.fill)}}` : jsxTextOf(p.text))).join(''), src: n.k, run: ps }];
        }
        const b = braced(t);
        if (b && !b.rest.trim()) return block(`{${E(b.inner)}}`);
        const one = (kids, what) => {
          if (kids.length !== 1) { err(inf, `Put one thing under "${what}": several things go in "together".`); }
          return kids.length ? render(kids[0], level + 1) : [{ text: 'null', src: n.k }];
        };
        const wrap = (head, inner, tail) => (inner.length === 1 && !inner[0].raw ? [{ text: head + inner[0].text + tail, src: n.k }] : [{ text: head + '(', src: n.k }, ...inner.map(ind), { text: ')' + tail, src: n.k }]);
        if ((m = t.match(/^only if\s+(.+)$/i))) {
          note(inf, '`a && b` shows b only while a is true (and nothing otherwise).');
          return wrap(`{${E(m[1])} && `, one(n.kids, 'only if'), '}');
        }
        if ((m = t.match(new RegExp(`^for each (${NAME}) in (.+?)(?:,\\s*counting with (${NAME}))?$`, 'i')))) {
          note(inf, '`.map` shows one of these for each item in the list. Each needs its own key ("keyed by …"), so React can tell them apart.');
          const add = [m[1], m[3]].filter(Boolean).filter(v => !c.x.vars.has(v));
          add.forEach(v => c.x.vars.add(v));
          try { return wrap(`{${E(m[2])}.map((${m[1]}${m[3] ? ', ' + m[3] : ''}) => `, one(n.kids, 'for each'), ')}'); } finally { add.forEach(v => c.x.vars.delete(v)); }
        }
        if (/^nothing$/i.test(t)) return block('null');
        return element(n, level, inf);
      };
      // "if …" / "otherwise" pairs among siblings
      const list = (nodes, level) => {
        const lines = [];
        for (let k = 0; k < nodes.length; k++) {
          const n = nodes[k], inf = c.info[n.k];
          const m = n.t.match(/^if\s+(.+)$/i);
          if (m) {
            const nx = nodes[k + 1], other = nx && /^otherwise$/i.test(nx.t) ? nx : null;
            if (!other) err(inf, 'In what a component shows, "if …" needs an "otherwise" after it (with "nothing" under it, if it shows nothing).');
            note(inf, '`c ? a : b` shows a while c is true, b otherwise.');
            const side = (x) => (x && x.kids.length === 1 ? render(x.kids[0], level + 1) : (x && x.kids.length > 1 && err(c.info[x.k], 'Put one thing under it: several things go in "together".'), [{ text: 'null', src: (x || n).k }]));
            const a = side(n), b2 = side(other);
            if (a.length === 1 && b2.length === 1 && !a[0].raw && !b2[0].raw) lines.push({ text: `{${c.E(m[1])} ? ${a[0].text} : ${b2[0].text}}`, src: n.k });
            else lines.push({ text: `{${c.E(m[1])} ? (`, src: n.k }, ...a.map(ind), { text: ') : (', src: other ? other.k : n.k }, ...b2.map(ind), { text: ')}', src: n.k });
            if (other) k++;
            continue;
          }
          if (/^otherwise$/i.test(n.t)) { err(inf, '"otherwise" goes right after an "if …" at the same indent.'); continue; }
          lines.push(...render(n, level));
        }
        return lines;
      };
      /* An element line: "a button saying "Save", styled "px-4", running save when clicked", its children under it. */
      function element(n, level, inf) {
        // the settings after commas (a part that isn't a setting belongs to the one before it: "run f with a, b")
        const parts = topSplit(n.t, /,\s+/g);
        const SET = /^(?:styled\s|keyed by\s|running\s|when\s|with\s)/i;
        const settings = [];
        let head = parts[0];
        for (let k = 1; k < parts.length; k++) {
          if (SET.test(parts[k])) settings.push({ t: parts[k], inf, k: n.k });
          else if (settings.length) settings[settings.length - 1].t += ', ' + parts[k];
          else head += ', ' + parts[k];
        }
        // settings on lines of their own, first under it: the tag is written with one setting per line too
        let ownLines = 0;
        while (ownLines < n.kids.length && SET.test(n.kids[ownLines].t) && !n.kids[ownLines].kids.length) {
          const kn = n.kids[ownLines++];
          settings.push({ t: kn.t, inf: c.info[kn.k], k: kn.k, line: true });
        }
        const kidsOf = n.kids.slice(ownLines);
        const hm = head.match(/^(?:(?:a|an)\s+)?(.+?)(?:\s+(to|of)\s+("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'))?(?:\s+saying\s+(.+))?$/i);
        if (!hm) { err(inf, 'I don\'t recognise this. What a component shows is one thing per line: an element ("a button saying "Save""), text in quotes, {a value}, "only if …", "if …", "for each …".'); return [{ text: `{/* ??? ${n.t} */}`, src: n.k }]; }
        let word = hm[1], tag = null;
        const attrs = [];
        // react-router: a Route for "/about" showing an About
        const route = word.match(new RegExp(`^Route for ("(?:[^"\\\\]|\\\\.)*"|'(?:[^'\\\\]|\\\\.)*') showing an? ([A-Z][\\w$]*)$`));
        if (route) { word = 'Route'; attrs.push(`path=${route[1]}`, `element={<${route[2]} />}`); note(inf, `A route: at the address ${route[1]}, the router shows ${code('<' + route[2] + ' />')}.`); }
        // shadcn/ui: a ghost Button is <Button variant="ghost">
        const variant = word.match(new RegExp(`^([a-z][a-z-]*) ([A-Z][\\w$]*(?:\\.[\\w$]+)*)$`));
        if (variant) { word = variant[2]; attrs.push(`variant="${variant[1]}"`); note(inf, `\`variant="${variant[1]}"\` picks one of the looks ${code(variant[2])} comes in.`); }
        let comp = word.match(new RegExp(`^(${NAME}(?:\\.${NAME})*)$`));
        if (/^together$/i.test(word)) tag = '';
        else if (comp && /^[A-Z]/.test(word) && /^an?\s/i.test(head)) tag = word;
        else if ((tag = WEB().wordTag(word))) { /* an HTML element */ }
        else if ((comp = word.match(/^([a-z][\w-]*) element$/i))) tag = comp[1];
        else { err(inf, `I don't know "${word}" as something to show. Use an element's words (a block, a heading, a button…), or a component's name with a or an before it ("a Button").`); return [{ text: `{/* ??? ${n.t} */}`, src: n.k }]; }
        if (hm[2]) {
          const nm = tag === 'img' && /^of$/i.test(hm[2]) ? 'src' : tag === 'a' && /^to$/i.test(hm[2]) ? 'href' : /^[A-Z]/.test(tag) && /^to$/i.test(hm[2]) ? 'to' : null;
          if (!nm) err(inf, `"${hm[2]} …" goes with a link ("a link to "/about""), a picture ("a picture of "logo.png"") or a component's address ("a Link to "/about"").`);
          else attrs.push(`${nm}=${hm[3]}`);
        }
        const srcs = attrs.map(() => n.k);   // the sentence line each setting is said on
        const setting = (st) => {
          const inf = st.inf, t = st.t;
          let m;
          // Tailwind classes in words: styled as flexible layout, items centred, gap 2, "hover:bg-accent"
          if ((m = t.match(/^styled as\s+(.+)$/i))) {
            const errs = [], cls = tailwindClasses(m[1], errs);
            errs.forEach(e => err(inf, e));
            note(inf, `Tailwind classes, one for each style said: \`className="${cls || '…'}"\`. Tailwind turns each class into a CSS rule.`);
            attrs.push(`className="${cls || ''}"`);
            return;
          }
          if ((m = t.match(/^styled\s+(.+)$/i))) { const v = m[1].trim(), b = braced(v); attrs.push(QUOTED.test(v) ? `className=${v}` : b && !b.rest.trim() ? `className={${c.E(b.inner)}}` : (err(inf, 'Its style is text in quotes (styled "p-4 rounded"), or a value in braces (styled {…}).'), 'className=""')); return; }
          if ((m = t.match(/^keyed by\s+(.+)$/i))) { attrs.push(`key={${c.E(m[1])}}`); return; }
          if ((m = t.match(/^running\s+(.+?)\s+when\s+(.+)$/i))) { const ev = eventProp(m[2]); if (!ev) err(inf, `I don't know the event "${m[2]}".`); attrs.push(`${ev || 'onClick'}={${c.E(m[1])}}`); return; }
          if ((m = t.match(new RegExp(`^when\\s+(.+?)(?:\\s+with\\s+(${NAME}))?:\\s*(.+)$`, 'i')))) {
            const ev = eventProp(m[1]);
            if (!ev) err(inf, `I don't know the event "${m[1]}".`);
            const step = stepCode(m[3].trim(), c, inf, m[2]);
            note(inf, `\`${ev || 'on…'}={(${m[2] || ''}) => …}\`: a little tool React runs ${ev ? 'each time it is ' + m[1].trim() : 'then'}.`);
            attrs.push(`${ev || 'onClick'}={(${m[2] || ''}) => ${step == null ? 'undefined' : step}}`);
            return;
          }
          if ((m = t.match(/^with everything in\s+(.+)$/i))) { attrs.push(`{...${c.E(m[1])}}`); return; }
          if ((m = t.match(/^with\s+([A-Za-z_$][\w$-]*)(?:\s+(.+))?$/i))) {
            const v = m[2] != null ? m[2].trim() : null, b = v != null ? braced(v) : null;
            if (v == null) attrs.push(m[1]);
            else if (QUOTED.test(v)) attrs.push(`${m[1]}=${v}`);
            else if (b && !b.rest.trim()) attrs.push(`${m[1]}={${c.E(b.inner)}}`);
            else { err(inf, `The value of ${code(m[1])} is text in quotes, or a value in braces: with ${m[1]} {…}.`); attrs.push(m[1]); }
          }
        };
        for (const st of settings) { setting(st); while (srcs.length < attrs.length) srcs.push(st.k); }
        if (ownLines) note(inf, 'Its settings are on lines of their own, under it: the tag has one setting per line too.');
        if (tag === '' && attrs.length) err(inf, '"together" (a fragment) takes no settings.');
        // the tag's opening: on one line, or (settings on lines of their own) "<Tag", a setting per line, then > or />
        const lined = ownLines > 0 && tag !== '';
        const opening = (end) => (lined ? [{ text: `<${tag}`, src: n.k }, ...attrs.map((a, k) => ({ text: a, src: srcs[k], d: 1 })), { text: end, src: n.k }] : [{ text: `<${tag}${attrs.length ? ' ' + attrs.join(' ') : ''}${end === '/>' ? ' />' : '>'}`, src: n.k }]);
        const open = tag === '' ? '<>' : `<${tag}${attrs.length ? ' ' + attrs.join(' ') : ''}>`, close = tag === '' ? '</>' : `</${tag}>`;
        // (a tag on several lines with the rest after its >: the last line of the opening gets it)
        const ending = (rest) => { const o = opening('>'); o[o.length - 1] = { ...o[o.length - 1], text: o[o.length - 1].text + rest }; return o; };
        // what's inside: "saying …" on the line, or the lines under it
        let kids = [];
        if (hm[4] != null) {
          const v = hm[4].trim(), b = braced(v);
          if (QUOTED.test(v)) { const ps = runPieces(v); if (!ps) err(inf, 'A { in this text isn\'t closed.'); kids = [{ text: (ps || []).map(p => (p.fill != null ? `{${c.E(p.fill)}}` : jsxTextOf(p.text))).join(''), src: n.k, run: ps || [] }]; }
          else if (b && !b.rest.trim()) kids = [{ text: `{${c.E(b.inner)}}`, src: n.k }];
          else err(inf, 'What it says is text in quotes ("Save") or a value in braces ({title}).');
          if (kidsOf.length) err(inf, 'It says something already ("saying …"), so put what goes inside it on the lines under it instead.');
          return lined ? ending(kids.map(k => k.text).join('') + close) : [{ text: open + kids.map(k => k.text).join('') + close, src: n.k }];
        }
        const inner = list(kidsOf, level + 1);
        if (!inner.length) return tag === '' ? [{ text: '<></>', src: n.k }] : opening('/>');
        // spaces at the edge of a text keep everything on one line (JSX drops them at a line's ends)
        const edge = inner.some(o => o.run && o.run.length && ((o.run[0].text != null && /^\s/.test(o.run[0].text)) || (o.run[o.run.length - 1].text != null && /\s$/.test(o.run[o.run.length - 1].text))));
        if (edge) {
          let one = '';
          for (const o of inner) one += o.raw ? '\n' + o.text : o.text;
          if (lined) { const ls = (one + close).split('\n'); return [...ending(ls[0]), ...ls.slice(1).map(l => ({ text: l, src: n.k }))]; }
          return (open + one + close).split('\n').map((l, i) => ({ text: l, src: n.k }));
        }
        return [...opening('>'), ...inner.map(ind), { text: close, src: n.k }];
      }
      for (const o of list(nodes, 0)) out.push(o);
      return out;
    }

    /* The JSX under line i (to j) written as lines, pushed at the right indent. */
    function pushJsx(c, from, to, lead, tail) {
      const tree = treeOf(c, from, to);
      if (tree.filter(n => !/^(?:note|comment)\s*:/i.test(n.t)).length > 1) err(c.inf, 'A component shows one thing: put several under "together", or in a block.');
      const lines = jsx(c, tree);
      c.push(c.pad + lead, c.i);
      for (const o of lines) c.push(o.keep ? o.text : c.pad + '  ' + '  '.repeat(o.d || 0) + o.text, o.src);
      c.push(c.pad + tail, c.i);
    }

    /* An element said after "show:" (or ", showing:") on its line: on one line of code when it fits on one, in
       brackets over several otherwise. */
    function oneJsx(c, words, lead, tail) {
      if (blockEnd(c.lines, c.i) > c.i) err(c.inf, 'What it shows goes after "show:" or on the lines under it, not both.');
      const lines = jsx(c, [{ k: c.i, ind: 0, raw: words, t: words, kids: [] }]);
      if (lines.length === 1 && !lines[0].raw) { c.say(lead + lines[0].text + tail); return; }
      c.push(c.pad + lead + '(', c.i);
      for (const o of lines) c.push(o.keep ? o.text : c.pad + '  ' + '  '.repeat(o.d || 0) + o.text, o.src);
      c.push(c.pad + ')' + tail, c.i);
    }

    function reactLine(s, c) {
      const inf = c.inf;
      let m;
      const h = componentHead(s);
      if (h) {
        if (h.bad) { err(inf, h.bad); return false; }
        if (h.exp === 'main' && h.arrow) err(inf, 'A component made with constant can\'t be the main part where it is made: add "share Card as the main part" after it.');
        if (c.stack.length) err(inf, 'A component is defined at the left edge, not inside a block.');
        if (h.type && !typed) err(inf, 'Types are TypeScript: a JavaScript file has none. Leave out "from …".');
        const pr = h.list ? propsCode(h.list, inf) : null;
        const params = pr ? pr.code + (h.type ? ': ' + h.type : '') : '';
        const exp = h.exp ? EXPORT_WORD[h.exp] : '';
        note(inf, `A component is a tool that gives back what to show (JSX). React runs it again whenever its props or its state change.${pr ? ` Its props come in as one object, taken apart here: ${code(pr.code)}.` : ''}`);
        if (h.showing && h.one) { oneJsx(c, h.one, `${exp}const ${h.name} = (${params}) => `, ';'); return true; }
        if (h.showing) {
          const j = blockEnd(c.lines, c.i);
          pushJsx(c, c.i + 1, j, `${exp}const ${h.name} = (${params}) => (`, ');');
          c.skip(j);
          return true;
        }
        c.open(h.arrow ? `${exp}const ${h.name} = (${params}) => {` : `${exp}function ${h.name}(${params}) {`, h.arrow ? '};' : '}', 'fn', { def: true });
        if (pr) pr.names.forEach(n => c.declare(n, 'const'));
        return true;
      }
      // show: an element said on the same line, given back on one line: return <p>Loading…</p>;
      if ((m = s.match(/^show:\s+(\S.*)$/i))) {
        if (!c.insideFn()) err(inf, '"show:" goes inside a component: what it shows.');
        note(inf, '`return <…>;` gives back what the component shows, written in JSX, on one line as the sentence is.');
        oneJsx(c, m[1], 'return ', ';');
        return true;
      }
      if (/^show$/i.test(s) && /:\s*$/.test(c.raw)) {
        if (!c.insideFn()) err(inf, '"show:" goes inside a component: what it shows.');
        note(inf, '`return ( … )` gives back what the component shows, written in JSX: elements like HTML, with {values} in them.');
        const j = blockEnd(c.lines, c.i);
        if (j === c.i) err(inf, 'Put what it shows on the lines under "show:", one step further in.');
        pushJsx(c, c.i + 1, j, 'return (', ');');
        c.skip(j);
        return true;
      }
      // keep count, starting at 0 (and its type, and a setter with another name)
      if ((m = s.match(new RegExp(`^keep (${NAME})(?:\\s+\\((.+)\\))?,\\s+(?:starting at\\s+(.+?)|with no starting value)(?:,\\s+changed with\\s+(${NAME}))?$`, 'i'))) && !/^a$/i.test(m[1])) {
        const errs = [], t = m[2] != null ? typeTs(m[2], 'arg', errs) : null;
        errs.forEach(e => err(inf, e));
        if (m[2] != null && !typed) err(inf, 'Types are TypeScript: a JavaScript file has none.');
        const set = m[4] || states.get(m[1]) || 'set' + m[1][0].toUpperCase() + m[1].slice(1);
        note(inf, `\`useState\` keeps ${code(m[1])} between showings of the component${m[3] != null ? ', starting at the value given' : ''}. ${code(set)} changes it, and React shows the component again.`);
        c.declare(m[1], 'const'); c.declare(set, 'const');
        c.say(`const [${m[1]}, ${set}] = useState${t != null ? `<${t}>` : ''}(${m[3] != null ? c.E(m[3]) : ''});`);
        return true;
      }
      if ((m = s.match(new RegExp(`^keep a reference (${NAME})(?:\\s+\\(to\\s+(.+)\\))?(?:,\\s+starting at\\s+(.+))?$`, 'i')))) {
        const errs = [], t = m[2] != null ? typeTs(m[2], 'arg', errs) : null;
        errs.forEach(e => err(inf, e));
        note(inf, `\`useRef\` keeps ${code(m[1])} (its \`.current\`) between showings without showing the component again: often an element on the page (with ref {${m[1]}}).`);
        c.declare(m[1], 'const');
        c.say(`const ${m[1]} = useRef${t != null ? `<${t}>` : ''}(${m[3] != null ? c.E(m[3]) : ''});`);
        return true;
      }
      // effects: when Card first appears, whenever query or page changes; when Card goes away (its clean-up)
      if ((m = s.match(new RegExp(`^when (?:${NAME}|this|it) first appears$`, 'i'))) || (m = s.match(/^whenever (.+) changes$/i))) {
        const deps = m[1] && !/^when /i.test(m[0]) ? topSplit(m[1], /\s+or\s+|,\s*/g).map(d => c.E(d)) : [];
        if (!c.insideFn()) err(inf, 'An effect goes inside a component.');
        note(inf, deps.length ? `\`useEffect\` runs these steps after the component is first shown, and again whenever ${deps.map(code).join(' or ')} change${deps.length > 1 ? '' : 's'}.` : '`useEffect` with `[]` runs these steps once, after the component is first shown.');
        c.open('useEffect(() => {', `}, [${deps.join(', ')}]);`, 'fn');
        return true;
      }
      if ((m = s.match(new RegExp(`^when (?:${NAME}|this|it) goes away(?:,\\s+(.+))?$`, 'i')))) {
        const top = c.stack[c.stack.length - 1];
        if (!top || !/^useEffect\(/.test(top.head ? top.head.text.trim() : '')) err(inf, '"when … goes away" goes right inside an effect ("when … first appears", "whenever … changes").');
        note(inf, 'The function an effect gives back is its clean-up: React runs it when the component goes away (and before the effect runs again).');
        if (m[1]) { const step = stepCode(m[1].trim(), c, inf); c.say(`return () => ${step == null ? 'undefined' : step};`); return true; }
        c.open('return () => {', '};', 'fn');
        return true;
      }
      if ((m = s.match(new RegExp(`^change (${NAME}) (?:from ${NAME} )?to (.+)$`, 'i')))) {
        const step = stepCode(s, c, inf);
        c.say(`${step == null ? '' : step};`);
        return true;
      }
      // constant visible is …, worked out again whenever notes or filter changes (useMemo)
      if ((m = s.match(new RegExp(`^constant (${NAME}) is (.+?), worked out (?:again whenever (.+) changes|once)$`, 'i')))) {
        const deps = m[3] ? topSplit(m[3], /\s+or\s+|,\s*/g).map(d => c.E(d)) : [];
        note(inf, `\`useMemo\` keeps the value and works it out again only when ${deps.length ? deps.map(code).join(' or ') + ' change' : 'the component first appears'}, not every time the component is shown.`);
        if (c.known(m[1])) err(inf, `${code(m[1])} already exists here, so it can't be made again.`);
        c.declare(m[1], 'const');
        const v = c.E(m[2]);
        c.say(`const ${m[1]} = useMemo(() => ${/^\{/.test(v) ? `(${v})` : v}, [${deps.join(', ')}]);`);
        return true;
      }
      // take toast from the result of useToast: const { toast } = useToast(); "data as notes (or an empty list)" is
      // data: notes = []; "wait for …, and take data and error from it" waits first
      const take = (list, value, wait) => {
        const parts = [];
        for (const it of topSplit(list, /,\s*|\s+and\s+/g)) {
          const q = it.match(new RegExp(`^(${NAME})(?:\\s+as\\s+(${NAME}))?(?:\\s+\\(or\\s+(.+)\\))?$`, 'i'));
          if (!q) { err(inf, 'Name each part to take, like: take data and error from …, or "data as notes (or an empty list)".'); continue; }
          const d = q[3] != null ? ' = ' + c.E(q[3]) : '';
          parts.push(q[2] ? `${q[1]}: ${q[2]}${d}` : `${q[1]}${d}`);
          c.declare(q[2] || q[1], 'const');
        }
        note(inf, `\`const { ${parts.join(', ')} } = …\` takes those parts out of the object, each as a name of its own` + (parts.some(p => /:/.test(p)) ? ' (`data: notes` names the part data notes here)' : '') + (parts.some(p => / = /.test(p)) ? '; `= …` is its value when the object has none' : '') + '.');
        c.say(`const { ${parts.join(', ')} } = ${wait ? 'await ' : ''}${c.E(value)};`);
        return true;
      };
      if ((m = s.match(/^wait for\s+(.+?),?\s+and take\s+(.+)\s+from it$/i))) { if (!c.insideFn()) err(inf, '"wait for" only works inside a block that runs later: "when …", "every …" or "define …".'); return take(m[2], m[1], true); }
      if ((m = s.match(/^take\s+(.+?)\s+from\s+(.+)$/i)) && !/\bout of group\b/i.test(s)) return take(m[1], m[2], false);
      // throw error: an error there already, passed on as it is
      if ((m = s.match(/^fail with\s+(.+)\s+as it is$/i))) {
        note(inf, '`throw` stops with this error, passed on as it is: whoever ran this can catch it with "try" and "if it fails".');
        c.say(`throw ${c.E(m[1])};`);
        return true;
      }
      // the app's start: show an App in the element called "root" (React DOM)
      if ((m = s.match(/^show an? ([A-Z][\w$]*) in\s+(.+)$/))) {
        note(inf, `\`createRoot(…).render(<${m[1]} />)\` starts React: it shows ${code('<' + m[1] + ' />')} in that element of the page, and keeps it up to date.`);
        c.say(`createRoot(${c.E(m[2])}).render(<${m[1]} />);`);
        return true;
      }
      // TanStack Query: mark the query ["notes"] in queryClient as out of date
      if (/^mark the query\s/i.test(s)) { const step = stepCode(s, c, inf); c.say(`${step == null ? '' : step};`); return true; }
      // give back a change made by addNote, with "when it works" (and "when it fails") under it (useMutation)
      if ((m = s.match(/^give back a change made by\s+(.+)$/i)) && blockEnd(c.lines, c.i) > c.i) {
        note(inf, '`useMutation` makes a change (saving, deleting…) the page can run with `.mutate(…)`. Under it: what to do when it works, or fails.');
        c.open('return useMutation({', '});', 'mutation');
        c.push(c.pad + '  ' + `mutationFn: ${c.E(m[1])},`, c.i);
        return true;
      }
      if ((m = s.match(/^when it (works|fails)(?:,\s+(.+))?$/i))) {
        const top = c.stack[c.stack.length - 1], key = /works/i.test(m[1]) ? 'onSuccess' : 'onError';
        if (!top || top.kind !== 'mutation') err(inf, `"when it ${m[1]}" goes right under "give back a change made by …".`);
        note(inf, `\`${key}\` runs when the change ${/works/i.test(m[1]) ? 'has worked' : 'has failed'}.`);
        if (m[2]) { const step = stepCode(m[2].trim(), c, inf); c.say(`${key}: () => ${step == null ? 'undefined' : step},`); return true; }
        c.open(`${key}: () => {`, '},', 'fn');
        return true;
      }
      const top = c.stack[c.stack.length - 1];
      if (top && top.kind === 'mutation') { err(inf, 'Under "give back a change made by …" go "when it works" and "when it fails", with their steps under them.'); c.say(`// ??? ${s}`); return true; }
      return undefined;
    }

    /* A sentence whose last value is a TanStack query, with what loads it on the line under it:
         take data and isLoading from the query ["notes"]
             loaded by fetchNotes
       is that sentence with "loaded by fetchNotes" at its end, and its code is one part per line. -> the sentence
       joined up, or null. */
    function queryOnLines(s, c) {
      const j = blockEnd(c.lines, c.i);
      if (j === c.i || !/\bthe query\b/i.test(s)) return null;
      const under = [];
      for (let k = c.i + 1; k <= j; k++) if (c.lines[k].trim()) under.push(k);
      const m = under.length === 1 ? c.lines[under[0]].trim().replace(/[.]$/, '').match(/^loaded by\s+(.+)$/i) : null;
      if (!m) return null;
      const mk = mask(s);
      let at = -1;
      for (const x of mk.matchAll(/(?:^| )the query (?=\S)/gi)) at = x.index;
      if (at < 0 || / loaded by /i.test(mk.slice(at))) return null;
      note(c.info[under[0]], 'What loads the query, on a line of its own: the code has each part of the query on a line of its own too.');
      c.skip(j);
      linedInf = c.inf;
      return `${s} loaded by ${m[1]}`;
    }

    /* The lines under this one, one after another, each one step in with nothing under it: { ks, j } (their
       indexes, the last one), or null. (Exact code and notes are lines of their own; "description: …" is a part
       here, as in toast's { title, description }: a tool's description only goes right under its "define".) */
    function linesUnder(c) {
      const j = blockEnd(c.lines, c.i), ks = [];
      for (let k = c.i + 1; k <= j; k++) { if (!c.lines[k].trim()) return null; ks.push(k); }
      if (!ks.length) return null;
      const ind = c.lines[ks[0]].match(/^ */)[0].length;
      return ks.every(k => c.lines[k].match(/^ */)[0].length === ind && !/^\s*(?:js|javascript|raw|note|comment)\s*:/i.test(c.lines[k])) ? { ks, j } : null;
    }

    /* bring in from "@/components/ui/card":
           Card
           CardContent
       is import { one name per line } from "…": a name (or "a as b", "the type Note") a line. */
    const ITEM = new RegExp(`^(the type )?(${NAME})(?: as (${NAME}))?$`, 'i');
    function importOnLines(s, c) {
      const m = s.match(new RegExp(String.raw`^bring in from (${Q})$`, 'i'));
      if (!m) return null;
      const u = linesUnder(c), inf = c.inf;
      if (c.stack.length) err(inf, '"bring in" goes at the left edge, near the top.');
      if (!u) { err(inf, 'Put the names to bring in on the lines under it, one per line, one step further in.'); c.say(`import {} from ${m[1]};`); return true; }
      note(inf, '`import { … }` brings in what another file shares, by name: here one name per line, as the sentences have them.');
      c.say('import {');
      for (const k of u.ks) {
        const q = c.lines[k].trim().match(ITEM);
        if (!q) { err(c.info[k], 'Name one thing to bring in on each line: a name, "a as b", or "the type Note".'); c.push(c.pad + '  // ??? ' + c.lines[k].trim(), k); continue; }
        if (q[1] && !typed) err(c.info[k], 'Types are TypeScript: a JavaScript file brings in none.');
        if (!q[1]) { c.declare(q[3] || q[2], 'const'); c.x.vars.add(q[3] || q[2]); }
        note(c.info[k], `${code(q[2])}${q[3] ? `, named ${code(q[3])} here` : ''}${q[1] ? ' (a type)' : ''}, brought in on a line of its own.`);
        c.push(`${c.pad}  ${q[1] ? 'type ' : ''}${q[2]}${q[3] ? ' as ' + q[3] : ''},`, k);
      }
      c.say(`} from ${m[1]};`);
      c.skip(u.j);
      return true;
    }

    /* A call's inputs, or the parts of the record it is given last, on the lines under its sentence:
         run console.error with:           run toast with:              wait for fetch with "/api" and:
             "Not found:"                      title: "Saved"               method: "POST"
             path                              variant: "destructive"       body: note as JSON text
       is the sentence with them in place of the colon, and its code has them a line each:
       console.error(\n  "Not found:",\n  path\n) and toast({\n  title: "Saved",\n  variant: "destructive",\n}).
       -> the sentence joined up (LINED standing for what is under it, which packValue writes), or null. */
    const LINED = '⟪under⟫';
    let lined = null;   // { inf, code(E) }: the value written over the lines under its sentence
    const PART = new RegExp(String.raw`^(${NAME}|${Q}|\d+):\s+(\S.*)$`);
    function partsOnLines(s, c) {
      const m = s.match(/^(.*\S)\s+(with|and)$/i);
      if (!m || !/:\s*$/.test(c.raw)) return null;
      const u = linesUnder(c);
      if (!u) return null;
      const said = u.ks.map(k => c.lines[k].trim()), pairs = said.map(t => t.match(PART));
      const record = pairs.some(Boolean), inf = c.inf;
      if (record && said.some((t, k) => !pairs[k] && !new RegExp(`^${NAME}$`).test(t))) {
        err(inf, 'Under "with:" go its inputs, one per line, or the parts of a record (name: value), one per line, not both.');
        return null;
      }
      if (!record && /^and$/i.test(m[2])) { err(inf, 'Under "… and:" go the parts of a record, one per line, like: title: "Saved".'); return null; }
      c.skip(u.j);
      if (record) {
        note(inf, 'The last thing it is given is a record (`{ … }`), its parts on the lines under it: the code has a part per line too.');
        u.ks.forEach(k => note(c.info[k], 'One part of the record: its name, then its value.'));
        lined = { inf, code: (E) => `{\n${said.map((t, k) => `  ${pairs[k] ? `${pairs[k][1]}: ${E(pairs[k][2])}` : t},`).join('\n')}\n}` };
        return /^with$/i.test(m[2]) ? `${m[1]} with ${LINED}` : `${m[1]}, ${LINED}`;
      }
      note(inf, 'What it is given, one per line under it: the code has each on a line of its own too.');
      u.ks.forEach(k => note(c.info[k], 'One of the things it is given.'));
      lined = { inf, code: (E) => `\n${said.map(t => '  ' + E(t)).join(',\n')}\n` };
      return `${m[1]} with ${LINED}`;
    }

    /* A Supabase query with its parts after the table on the lines under it, one per line:
         wait for every row of the "notes" table in supabase, and take data and error from it
             sorted by "created_at" from the end
       is the sentence with them after the table, and its code is one call per line:
       supabase\n  .from("notes")\n  .select("*")\n  .order(…). -> the sentence joined up, or null. */
    function chainOnLines(s, c) {
      const u = linesUnder(c);
      if (!u) return null;
      const parts = u.ks.map(k => c.lines[k].trim().replace(/[.]$/, ''));
      if (!parts.every(p => SUPA_PART.test(p))) return null;
      const mk = mask(s);
      let at = -1;
      for (const x of mk.matchAll(new RegExp(`(?:^| )the \u0001+ table in ${NAME}`, 'g'))) at = x.index + x[0].length;
      if (at < 0 || mask(s.slice(at)).search(SUPA_NEXT) === 0) return null;
      note(c.inf, 'A query with its parts on the lines under it: the code has each of its calls on a line of its own.');
      u.ks.forEach(k => note(c.info[k], 'One part of the query, on a line of its own: one call in the code.'));
      c.skip(u.j);
      linedChain = c.inf;
      return `${s.slice(0, at)} ${parts.join(' ')}${s.slice(at)}`;
    }

    function line(s0, c) {
      const own = importOnLines(s0, c);
      if (own) return own;
      const joined = queryOnLines(s0, c) || partsOnLines(s0, c) || chainOnLines(s0, c), s = joined || s0;
      const r = lineOf(s, c);
      // (a sentence these sentences write: the joined one)
      return joined && r === false ? { s } : r;
    }

    function lineOf(s, c) {
      const r = reactLine(s, c);
      if (r !== undefined) return r;
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
      const own = packValue(s, inf, E);
      if (own != null) return own;
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
      // the names under "bring in from "…":", one per line (the lines come in order: they are the ones after it)
      if (x.bringing) {
        if ((m = t.match(ITEM))) { if (!m[1]) x.vars.add(m[3] || m[2]); return; }
        x.bringing = false;
      }
      if (new RegExp(String.raw`^bring in from ${Q}$`, 'i').test(t)) { x.bringing = true; return; }
      if ((m = t.match(new RegExp(`^bring in everything from .+ as (${NAME})$`, 'i')))) x.vars.add(m[1]);
      else if ((m = t.match(/^bring in\s+(.+?)\s+from\s+["']/i)) && !/^the types?\s/i.test(m[1])) {
        for (const it of topSplit(m[1], /,\s*|\s+and\s+/g)) {
          const q = it.match(new RegExp(`^(?:(${NAME}) \\(the main part\\)|(${NAME})(?: as (${NAME}))?)$`, 'i'));
          if (q) x.vars.add(q[1] || q[3] || q[2]);
        }
      }
      // React: a component's props, a state and its setter, a reference, the parts taken from an object
      const h = componentHead(t);
      if (h && !h.bad) { x.fns.add(h.name); if (h.list) propsCode(h.list, null).names.forEach(n => x.vars.add(n)); }
      if ((m = t.match(new RegExp(`^keep (${NAME})(?:\\s+\\(.+\\))?,\\s+(?:starting at\\s+.+?|with no starting value)(?:,\\s+changed with\\s+(${NAME}))?$`, 'i'))) && !/^a$/i.test(m[1])) {
        const set = m[2] || 'set' + m[1][0].toUpperCase() + m[1].slice(1);
        states.set(m[1], set); x.vars.add(m[1]); x.fns.add(set);
      }
      if ((m = t.match(new RegExp(`^keep a reference (${NAME})\\b`, 'i')))) x.vars.add(m[1]);
      if (((m = t.match(/^wait for\s+.+?,?\s+and take\s+(.+)\s+from it$/i)) || (m = t.match(/^take\s+(.+?)\s+from\s+/i))) && !/\bout of group\b/i.test(t)) {
        for (const it of topSplit(m[1], /,\s*|\s+and\s+/g)) { const q = it.match(new RegExp(`^(${NAME})(?:\\s+as\\s+(${NAME}))?`, 'i')); if (q) x.vars.add(q[2] || q[1]); }
      }
    }

    // parens: a little function's one input in brackets, (n) => …, as Prettier writes TypeScript
    return { plain, names, line, expr, parens: typed };
  }

  /* ---------- Phrase pack: Tailwind classes in words ---------- */

  /* Each Tailwind class (the template on the left, {v} a value like 4, 0.5, px, auto, 3xl or blue-500) and the
     words for it. One class is one phrase and back, in order; a class with no words stays as written, in quotes.
     Variants go after the words: hover:underline is "underlined on hover". The first rule that fits wins. */
  const TW_SPACE = String.raw`(?:\d+(?:\.\d+)?|px|auto)`, TW_SIZE = String.raw`(?:xs|sm|base|md|lg|xl|[2-9]xl|none|full)`, TW_TOKEN = String.raw`[a-z][a-z0-9-]*(?:\/\d+)?`;
  const TW_RULES = [
    // layout
    ['flex', 'flexible layout'], ['inline-flex', 'flexible inline layout'], ['grid', 'grid layout'], ['block', 'block layout'], ['inline-block', 'inline block layout'], ['inline', 'inline layout'], ['hidden', 'hidden'], ['container', 'container width'],
    ['flex-col', 'items top to bottom'], ['flex-row', 'items side by side'], ['flex-wrap', 'items wrap onto new lines'], ['flex-1', 'takes the space left'], ['shrink-0', 'never shrinks'], ['grow', 'grows to fill'],
    ['items-center', 'items centred'], ['items-start', 'items at the start'], ['items-end', 'items at the end'], ['items-stretch', 'items stretched'], ['items-baseline', 'items on one baseline'],
    ['justify-between', 'spread out'], ['justify-center', 'centred along'], ['justify-start', 'packed at the start'], ['justify-end', 'packed at the end'], ['justify-around', 'spread out evenly'],
    ['self-center', 'centred itself'], ['mx-auto', 'centred'], ['ml-auto', 'pushed right'], ['mr-auto', 'pushed left'],
    ['grid-cols-{v}', '{v} columns', String.raw`\d+`], ['col-span-{v}', 'spans {v} columns', String.raw`\d+`],
    ['gap-{v}', 'gap {v}', TW_SPACE], ['gap-x-{v}', 'gap {v} across', TW_SPACE], ['gap-y-{v}', 'gap {v} down', TW_SPACE],
    ['space-y-{v}', '{v} apart top to bottom', TW_SPACE], ['space-x-{v}', '{v} apart side by side', TW_SPACE],
    // sizes
    ['w-full', 'full width'], ['h-full', 'full height'], ['w-screen', 'as wide as the screen'], ['h-screen', 'as tall as the screen'], ['min-h-screen', 'at least as tall as the screen'],
    ['w-{v}', 'width {v}', TW_SPACE], ['h-{v}', 'height {v}', TW_SPACE], ['size-{v}', 'size {v}', TW_SPACE], ['max-w-{v}', 'at most {v} wide', String.raw`(?:xs|sm|md|lg|xl|[2-7]xl|full|prose|screen-\w+)`], ['min-w-0', 'can shrink'],
    // space inside and around
    ['p-{v}', 'space inside {v}', TW_SPACE], ['px-{v}', 'space inside {v} across', TW_SPACE], ['py-{v}', 'space inside {v} up and down', TW_SPACE],
    ['pt-{v}', 'space inside {v} at the top', TW_SPACE], ['pb-{v}', 'space inside {v} at the bottom', TW_SPACE], ['pl-{v}', 'space inside {v} on the left', TW_SPACE], ['pr-{v}', 'space inside {v} on the right', TW_SPACE],
    ['m-{v}', 'space around {v}', TW_SPACE], ['mx-{v}', 'space around {v} across', TW_SPACE], ['my-{v}', 'space around {v} up and down', TW_SPACE],
    ['mt-{v}', 'space above {v}', TW_SPACE], ['mb-{v}', 'space below {v}', TW_SPACE], ['ml-{v}', 'space on the left {v}', TW_SPACE], ['mr-{v}', 'space on the right {v}', TW_SPACE],
    // text
    ['text-{v}', 'text size {v}', TW_SIZE], ['text-center', 'text centred'], ['text-left', 'text on the left'], ['text-right', 'text on the right'],
    ['font-bold', 'bold'], ['font-semibold', 'semi-bold'], ['font-medium', 'medium weight'], ['font-normal', 'normal weight'], ['font-light', 'light weight'], ['font-mono', 'typewriter font'],
    ['italic', 'italic'], ['underline', 'underlined'], ['no-underline', 'not underlined'], ['line-through', 'crossed out'], ['uppercase', 'in capitals'], ['lowercase', 'in lowercase'], ['capitalize', 'capitalised'],
    ['truncate', 'cut short with …'], ['whitespace-nowrap', 'on one line'], ['tracking-tight', 'letters close together'], ['tracking-wide', 'letters spread out'], ['leading-none', 'lines close together'], ['leading-relaxed', 'lines spread out'],
    // colours (after the sizes and the rest of text-…)
    ['text-{v}', 'text colour {v}', TW_TOKEN], ['bg-{v}', 'background colour {v}', TW_TOKEN],
    // borders and corners
    ['border', 'a border'], ['border-{v}', 'a border {v} wide', String.raw`\d+`], ['border-t', 'a border at the top'], ['border-b', 'a border at the bottom'], ['border-l', 'a border on the left'], ['border-r', 'a border on the right'],
    ['border-dashed', 'a dashed border'], ['border-dotted', 'a dotted border'], ['border-none', 'no border'], ['border-{v}', 'border colour {v}', TW_TOKEN],
    ['rounded', 'rounded corners'], ['rounded-full', 'fully rounded'], ['rounded-none', 'square corners'], ['rounded-{v}', 'rounded corners {v}', String.raw`(?:sm|md|lg|xl|[23]xl)`],
    // effects
    ['shadow', 'a shadow'], ['shadow-none', 'no shadow'], ['shadow-{v}', 'a shadow {v}', String.raw`(?:sm|md|lg|xl|2xl|inner)`], ['opacity-{v}', 'opacity {v}', String.raw`\d+`],
    ['transition', 'changes animate'], ['transition-{v}', '{v} changes animate', String.raw`(?:all|colors|opacity|shadow|transform)`], ['duration-{v}', 'animation {v} ms', String.raw`\d+`],
    ['cursor-pointer', 'hand cursor'], ['outline-none', 'no outline'], ['overflow-hidden', 'overflow hidden'], ['overflow-auto', 'scrolls if it must'],
    ['relative', 'positioned relative'], ['absolute', 'positioned absolute'], ['fixed', 'fixed in place'], ['sticky', 'sticks in place'], ['inset-0', 'fills its container'], ['top-0', 'at the very top'], ['z-{v}', 'layer {v}', String.raw`\d+`],
  ];
  const TW_VARIANTS = [['hover', 'on hover'], ['focus', 'on focus'], ['active', 'while pressed'], ['disabled', 'while disabled'], ['dark', 'in dark mode'], ['sm', 'on small screens and up'], ['md', 'on medium screens and up'], ['lg', 'on large screens and up'], ['xl', 'on extra large screens and up']];
  const twEsc = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
  const TW = TW_RULES.map(([cls, words, v]) => ({
    cls: new RegExp('^' + twEsc(cls).replace('\\{v\\}', `(${v || TW_TOKEN})`) + '$'),
    words: new RegExp('^' + twEsc(words).replace('\\{v\\}', `(${v || TW_TOKEN})`) + '$'),
    toWords: (m) => words.replace('{v}', m[1]), toCls: (m) => cls.replace('{v}', m[1]),
  }));
  function twWord(c) {
    let variant = '', base = c;
    const vm = c.match(/^([a-z]+):(.+)$/);
    if (vm) { const v = TW_VARIANTS.find(x => x[0] === vm[1]); if (!v) return null; variant = ' ' + v[1]; base = vm[2]; }
    for (const r of TW) { const m = base.match(r.cls); if (m) return r.toWords(m) + variant; }
    return null;
  }
  function twClass(w) {
    let variant = '', base = w.trim();
    for (const [v, said] of TW_VARIANTS) if (base.endsWith(' ' + said)) { variant = v + ':'; base = base.slice(0, -said.length - 1); break; }
    for (const r of TW) { const m = base.match(r.words); if (m) return variant + r.toCls(m); }
    return null;
  }
  /* "flex items-center gap-2" -> "flexible layout, items centred, gap 2" (null when the classes aren't one space apart,
     or nothing would be said in words) */
  function tailwindWords(classes) {
    const cs = String(classes).split(' ');
    if (!cs.length || cs.some(c => !c) || cs.join(' ') !== classes) return null;
    const said = cs.map(c => { const w = twWord(c); return w != null && twClass(w) === c ? w : /^[^\s"\\,]+$/.test(c) ? `"${c}"` : null; });
    return said.some(w => w == null) || said.every(w => /^"/.test(w)) ? null : said.join(', ');
  }
  /* The words back into classes, or null with the problem in errs. */
  function tailwindClasses(words, errs) {
    const out = [];
    for (const w of topSplit(words, /,\s*/g)) {
      const q = w.match(/^"([^"\s]+)"$/);
      if (q) { out.push(q[1]); continue; }
      const c = twClass(w);
      if (c == null) { errs.push(`I don't know "${w}" as a style. Put a Tailwind class in quotes ("hover:bg-accent"), or say it in words: space inside 4, text size sm, bold, background white…`); return null; }
      out.push(c);
    }
    return out.join(' ');
  }

  const freshShared = () => ({ ids: {}, groups: {}, cssGroups: {}, addGroups: {} });
  const EXTS = {};
  const extFor = (lang) => (EXTS[lang] = EXTS[lang] || ext(lang));

  /* An if with its one step on its own line, as the code has it: "if error, fail with error as it is" is
     if (error) throw error;. The step is a sentence that can't be part of a value, so the comma before it can't be
     part of the test ("if the result of f with a, b, give back c" tests f(a, b)). */
  const IF_STEP = /^(?:give back(?:\s|$)|fail with\s|stop the loop$|skip to next$|run\s|show:\s|change\s\S+\s(?:from\s\S+\s)?to\s)/i;
  /* -> { test, step } for "if test, step" on one line, or null. */
  function oneLineIf(t) {
    const m = t.match(/^if\s+(.+)$/i);
    if (!m) return null;
    const mk = mask(m[1]);
    for (const x of mk.matchAll(/,\s+/g)) {
      const step = m[1].slice(x.index + x[0].length).replace(/[.]$/, ''), test = m[1].slice(0, x.index).trim();
      if (test && IF_STEP.test(step) && !oneLineIf(step)) return { test, step };
    }
    return null;
  }
  /* The sentences with each one-line if as the if and its step under it (what compileJs writes), and where each
     came from: back[n] is the line of the text for line n; joins: the if lines whose code goes back on one line. */
  function splitIfs(lines) {
    const out = [], back = [], joins = [];
    lines.forEach((l, i) => {
      const t = l.trim(), pad = l.match(/^\s*/)[0];
      let nx = i + 1;
      while (nx < lines.length && !lines[nx].trim()) nx++;
      const under = nx < lines.length && lines[nx].match(/^\s*/)[0].length > pad.length;
      const p = !/^(?:js|ts|tsx|javascript|raw|note|comment)\s*:/i.test(t) && !under ? oneLineIf(t) : null;
      if (!p) { out.push(l); back.push(i); return; }
      joins.push(out.length);
      out.push(`${pad}if ${p.test}`, `${pad}    ${p.step}`);
      back.push(i, i);
    });
    return { lines: out, back, joins };
  }
  /* The code for each one-line if put back on one line (if (c) step;), and the result's lines and info for the
     text as it was. */
  function joinIfs(r, n, back, joins) {
    const out = [];
    for (let k = 0; k < r.lines.length; k++) {
      const o = r.lines[k];
      if (joins.includes(o.src) && /\{$/.test(o.text)) {
        const step = r.lines[k + 1], end = r.lines[k + 2];
        if (step && end && step.src === o.src + 1 && end.src === o.src && (!r.lines[k + 3] || r.lines[k + 3].src !== o.src + 1) && /^\s*\}$/.test(end.text) && /^\s*if \(.*\) \{$/.test(o.text)) {
          out.push({ ...o, text: `${o.text.slice(0, -2)} ${step.text.trim()}` });
          k += 2;
          continue;
        }
      }
      out.push(o);
    }
    const info = Array.from({ length: n }, (_, i) => ({ line: i, py: [], notes: [], warns: [], errs: [] }));
    r.info.forEach((inf, e) => {
      const to = info[back[e]];
      for (const key of ['notes', 'warns', 'errs']) for (const s of inf[key] || []) if (!to[key].includes(s)) to[key].push(s);
      for (const key of Object.keys(inf)) if (!(key in to)) to[key] = inf[key];
    });
    const lines = out.map(o => ({ ...o, src: o.src >= 0 ? back[o.src] : o.src }));
    lines.forEach((o, idx) => { if (o.src >= 0) info[o.src].py.push(idx); });
    // the text, as compileJs makes it (blank lines that are exact code's own kept as they are)
    const runs = [];
    for (const o of lines) {
      if (o.kept) runs.push('');
      else if (Array.isArray(runs[runs.length - 1])) runs[runs.length - 1].push(o.text);
      else runs.push([o.text]);
    }
    return { ...r, lines, info, text: runs.map(x => (Array.isArray(x) ? x.join('\n').replace(/\n{3,}/g, '\n\n') : x)).join('\n') + '\n' };
  }

  function compileTs(sec, shared, opts = {}) {
    const lang = opts.lang || 'ts';
    // exact lines (ts: / tsx:) are given to the JavaScript writer as its own exact lines, which it copies as written
    const RAW = lang === 'tsx' ? /^(\s*)(?:tsx|ts)\s*:/i : lang === 'ts' ? /^(\s*)ts\s*:/i : null;
    const given = RAW ? String(sec.text).split('\n').map(l => l.replace(RAW, '$1js:')) : String(sec.text).split('\n');
    // (TypeScript: an if with its step on its line is written as the if with the step under it, then put back on one line)
    const sp = lang !== 'js' ? splitIfs(given) : null;
    let r = root.IntuiWeb.compileJs({ ...sec, text: (sp ? sp.lines : given).join('\n') }, shared || freshShared(), extFor(lang));
    if (sp && sp.joins.length) r = joinIfs(r, given.length, sp.back, sp.joins);
    if (lang !== 'js') for (const inf of r.info) inf.notes = inf.notes.map(n => (n === 'Raw JavaScript: copied exactly as written.' ? 'Raw TypeScript: copied exactly as written.' : n));
    return r;
  }

  /* ---------- Phrase picker and Index content ---------- */

  const T = (group, pattern, code2, tip) => ({ group, pattern, py: code2, tip, sections: ['typescript'] });
  const TEMPLATES = [
    T('Types', 'set ‹total› (‹a number›) to ‹0›', 'let total: number = 0;', 'A name made with set or constant can say its type in brackets: a number, text, true or false, a list of ‹Note›, a ‹User› or nothing.'),
    T('Types', 'define ‹add› using ‹a› (‹a number›), ‹b› (‹text, if any›) giving back ‹a number›', 'function add(a: number, b?: string): number {', '"if any": an input that can be left out (?). "giving back …": the type of what it gives back.'),
    T('Types', 'constant ‹handle› is a tool using ‹e› (‹a React.FormEvent›)', 'const handle = (e: React.FormEvent) => {', 'A little tool with typed inputs; its steps go under it.'),
    T('Types', 'define shape ‹Note›', 'interface Note {', 'Its parts go under it, one per line: id is text, read-only created is a Date, email is text, if any. "based on ‹Base›" builds on another shape.'),
    T('Types', 'define type ‹Filter› as ‹"all" or "done"›', 'type Filter = "all" | "done";', '"define type ‹Props› as a shape", with its parts under it, names an object type.'),
    T('Types', '‹data› assumed to be ‹a list of Note›', 'data as Note[]', 'Tells TypeScript what the value is. Nothing checks it when the program runs.'),
    T('Types', '(‹el› for sure)', 'el!', 'Tells TypeScript the value is there (not null or undefined).'),
    T('Files', 'bring in ‹App› (the main part) from "‹./App›"', 'import App from "./App";', 'Also: bring in everything from "‹react›" as ‹React›; bring in ‹Toaster› as ‹Sonner› from …; bring in "‹./index.css›"; bring in the type ‹Note› from ….'),
    T('Files', 'define shared ‹formatDate› using ‹iso› (‹text›)', 'export function formatDate(iso: string) {', '"shared" lets other files bring it in; "main" makes it the file\'s main part (export default). Also: shared constant …, share ‹a› and ‹b›, share ‹App› as the main part.'),
    T('Components', 'define component ‹Card› using ‹title› and ‹children› from ‹CardProps›', 'function Card({ title, children }: CardProps) {', 'What it shows goes under "show:". "define main component ‹App›" is the file\'s main part.'),
    T('Components', 'constant ‹Index› is a component', 'const Index = () => {', 'Add ", showing:" for one that only shows something, with what it shows under it.'),
    T('Components', 'show:', 'return ( … );', 'What the component shows, one thing per line, indented under it.'),
    T('State', 'keep ‹count›, starting at ‹0›', 'const [count, setCount] = useState(0);', 'Its type in brackets: keep ‹notes› (a list of Note), starting at an empty list. ", changed with ‹setX›" when the setter has another name.'),
    T('State', 'change ‹count› to ‹count plus 1›', 'setCount(count + 1);', '"change ‹count› from ‹c› to ‹c plus 1›" works from its value at the time: setCount((c) => c + 1).'),
    T('State', 'keep a reference ‹box› (to ‹an HTMLDivElement›), starting at nothing', 'const box = useRef<HTMLDivElement>(null);', 'Give it to an element with: with ref {‹box›}.'),
    T('State', 'constant ‹visible› is ‹…›, worked out again whenever ‹notes› changes', 'const visible = useMemo(() => …, [notes]);', ''),
    T('State', 'take ‹toast› from the result of ‹useToast›', 'const { toast } = useToast();', '"take ‹data› as ‹notes› (or an empty list) and ‹isLoading› from …" renames a part and gives its value when it is missing.'),
    T('Effects', 'when ‹Card› first appears', 'useEffect(() => { … }, []);', 'The steps under it run once, after the component is first shown.'),
    T('Effects', 'whenever ‹query› changes', 'useEffect(() => { … }, [query]);', '"whenever ‹a› or ‹b› changes" for several.'),
    T('Effects', 'when ‹Card› goes away', 'return () => { … };', 'Inside an effect: its clean-up. One step can go after a comma.'),
    T('Show', '‹a heading› saying "‹Hi {name}›"', '<h2>Hi {name}</h2>', 'Any element\'s words (a block, a paragraph, a button, a list item, a link to "/") or a component by name: a ‹Button›.'),
    T('Show', '‹a Button› saying "‹Save›", running ‹save› when clicked', '<Button onClick={save}>Save</Button>', 'Settings go after commas, in order: styled "…", keyed by …, with ‹name› "…" or {…}, with everything in ‹props›.'),
    T('Show', '‹a button›, when clicked: change ‹open› to ‹true›', '<button onClick={() => setOpen(true)} />', '"when changed with ‹e›: change ‹title› to ‹e.target.value›" names the event.'),
    T('Show', 'only if ‹loading›', '{loading && …}', 'What shows only while it is true goes under it.'),
    T('Show', 'if ‹done›', '{done ? … : …}', 'Then "otherwise" at the same indent; "nothing" under either side shows nothing.'),
    T('Show', 'for each ‹note› in ‹notes›', '{notes.map((note) => …)}', 'Give what it shows a key: keyed by ‹note.id›. Add ", counting with ‹i›" for its place.'),
    T('Show', 'together', '<> … </>', 'Several things shown as one.'),
    T('Show', '{‹title›}', '{title}', 'A value on its own line. "a space" is {" "}.'),
    T('Packs', 'styled as ‹flexible layout, items centred, gap 2›', 'className="flex items-center gap-2"', 'Tailwind classes in words, in order. A class with no words is written in quotes: "hover:bg-accent".'),
    T('Packs', 'a ‹ghost› ‹Button›', '<Button variant="ghost">', 'A shadcn/ui component\'s variant, before its name.'),
    T('Packs', 'a Route for "‹/about›" showing an ‹About›', '<Route path="/about" element={<About />} />', 'react-router. A link in the app: a Link to "‹/about›".'),
    T('Packs', 'every row of the "‹notes›" table in ‹supabase› sorted by "‹created_at›" from the end', 'supabase.from("notes").select("*").order("created_at", { ascending: false })', 'Also: adding ‹note› to …, changing ‹{ done }› in …, deleting from …; then where "‹id›" is ‹id›, at most ‹10›, as a single row.'),
    T('Packs', 'wait for ‹…›, and take ‹data› and ‹error› from it', 'const { data, error } = await …;', ''),
    T('Packs', 'give back the query ‹["notes"]› loaded by ‹fetchNotes›', 'return useQuery({ queryKey: ["notes"], queryFn: fetchNotes });', 'TanStack Query.'),
    T('Packs', 'give back a change made by ‹addNote›', 'return useMutation({ mutationFn: addNote, … });', 'Under it: "when it works" and "when it fails", each with its steps.'),
    T('Packs', 'mark the query ‹["notes"]› in ‹queryClient› as out of date', 'queryClient.invalidateQueries({ queryKey: ["notes"] });', ''),
    T('Packs', 'fail with ‹error› as it is', 'throw error;', '"fail with "…"" makes a new error: throw new Error(…).'),
    T('Packs', 'show an ‹App› in (the element called "‹root›" for sure)', 'createRoot(document.getElementById("root")!).render(<App />);', 'Where a React app starts.'),
  ];
  const WORDS = [['a number', 'number'], ['text', 'string'], ['true or false', 'boolean'], ['anything', 'any'], ['something unknown', 'unknown'], ['a list of Note', 'Note[]'], ['a User or nothing', 'User | null'],
    ['"all" or "done"', '"all" | "done"'], ['a Promise of nothing', 'Promise<void>'], ['a Record of text and a number', 'Record<string, number>'], ['a tool using id (text) giving back nothing', '(id: string) => void'],
    ['name (text, if any)', 'name?: string'], ['inputs (the rest, a list of X)', '...inputs: X[]'], ['read-only id is text', 'readonly id: string;'], ['data assumed to be a Note', 'data as Note'], ['(el for sure)', 'el!'],
    ['shared', 'export'], ['main', 'export default'], ['styled as …', 'className="…" (Tailwind)'], ['keyed by note.id', 'key={note.id}'], ['with everything in props', '{...props}'], ['a space', '{" "}'], ['together', '<>…</>'],
    ['running save when clicked', 'onClick={save}'], ['when open changes', 'onOpenChange'], ['nothing (under if / otherwise)', 'null']];
  const GUIDE = {
    name: 'TypeScript', purpose: 'TypeScript is JavaScript with types: it says what kind of value each name holds, and a checker finds mistakes before the program runs. React builds pages from components: tools that give back what to show (JSX, elements like HTML with {values} in them).',
    rules: [['Types say what a name holds', 'set total (a number) to 0. The checker stops text going where a number belongs.'], ['Shapes', 'define shape Note lists the parts an object has, one per line.'], ['Components show things', 'A component\'s "show:" is what it puts on the page; React shows it again when its props or state change.'], ['State', 'keep count, starting at 0 keeps a value between showings; change count to … shows the change.'], ['Effects', '"when Card first appears" and "whenever query changes" run steps after the page is shown.']],
    section: 'A TypeScript file, in sentences. Every Mechanics (JavaScript) sentence works here too; exact lines start with ts: (tsx: in a .tsx file).',
  };
  const OPENS_BLOCK = new RegExp(String.raw`^\s*(?:define (?:shared |main )?(?:component|shape) |define (?:shared )?type \S+ as a shape|constant \S+ is a component|show:?\s*$|when \S+ (?:first appears|goes away)\s*$|whenever .+ changes|give back a change made by |when it (?:works|fails)\s*$|only if |together\s*$)|` + root.IntuiWeb.OPENS_BLOCK.source, 'i');

  root.IntuiTs = { compileTs, typeTs, paramTs, ext: extFor, tailwindWords, tailwindClasses, TEMPLATES, WORDS, GUIDE, OPENS_BLOCK };
})(typeof window !== 'undefined' ? window : globalThis);

/* IntuaCode — TypeScript (and React, for .tsx and JSX) said in sentences: the parts lang/convert.js's JavaScript
 * reader doesn't know. convert.js asks these first, for every value (ex) and statement (one); anything they leave
 * (undefined) is said the JavaScript way. Everything said here is checked like the rest: the sentences are
 * written back (lang/ts_write.js) and the syntax trees compared, types and all.
 *
 *   ext(kind) -> { ex(node, C), one(node, depth, lvl, C) }   kind: 'ts', 'tsx' or 'js' (JavaScript: no types)
 *   sayType(node, pos) -> words for a type, or null when it stays as code
 *
 * C is the JavaScript reader's own toolkit (see `C` in convert.js): its output, ex, block, inside, say helpers.
 * No DOM here.
 */
(function (root) {
  'use strict';

  const named = (n) => { const out = []; for (let i = 0; i < n.namedChildCount; i++) out.push(n.namedChild(i)); return out; };
  const kids = (n) => { const out = []; for (let i = 0; i < n.childCount; i++) out.push(n.child(i)); return out; };
  const F = (n, f) => (n ? n.childForFieldName(f) : null);
  const isComment = (n) => n.type === 'comment';
  const real = (n) => named(n).filter(x => !isComment(x));
  const has = (n, t) => kids(n).some(k => k.type === t);
  const one1 = (s) => !/\n/.test(s);
  /* "a" or "an", by how the name sounds: an Event, a User, an HTMLInputElement (said letter by letter). The writer
     takes either. */
  const art = (w) => {
    const acronym = /^[A-Z]{2}/.test(w);
    const an = acronym ? /^[AEFHILMNORSX]/.test(w) : /^[aeio]/i.test(w) || (/^u/i.test(w) && !/^u(?:s|ni|ti|r|ku|ga)/i.test(w));
    return `${an ? 'an' : 'a'} ${w}`;
  };
  const andList = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}` : xs[0]);
  const plainQuoted = (s) => /^(["'])[^"'\\\n]*\1$/.test(s);
  const IND = '    ';   // (one step in, in sentences)
  // the steps an if can have on its own line ("if error, fail with error as it is"): what lang/ts_write.js reads there
  const IF_STEP = /^(?:give back(?:\s|$)|fail with\s|stop the loop$|skip to next$|run\s|show:\s|change\s\S+\s(?:from\s\S+\s)?to\s)/i;

  /* Are a tag's props one per line, the name on the line it opens on and its > (or />) on a line of its own after
     them?
       <Input
         id="title"
         value={title}
       /> */
  function propsOnLines(open, nameN, props) {
    const row = open.startPosition.row;
    if (!props.length || !nameN || nameN.startPosition.row !== row) return false;
    for (let k = 0; k < props.length; k++) if (props[k].startPosition.row !== row + 1 + k || props[k].endPosition.row !== props[k].startPosition.row) return false;
    const ks = kids(open), last = props[props.length - 1], end = ks[ks.findIndex(x => x.startIndex === last.startIndex) + 1];
    return !!end && end.startPosition.row === last.endPosition.row + 1 && open.endPosition.row === end.startPosition.row;
  }

  /* Is call(obj) laid out one part per line, the whole value of a statement? f({ on the call's line, each part on a
     line of its own with a comma after it, and }) on the line after the last:
       useQuery({
         queryKey: ["notes"],
         queryFn: fetchNotes,
       }) */
  function onLines(call, obj, parts) {
    const p = call.parent;
    if (!p || !/^(?:return_statement|variable_declarator|expression_statement|await_expression)$/.test(p.type)) return false;
    const row = obj.startPosition.row, ks = kids(obj);
    if (row !== call.startPosition.row || !parts.length || ks.some(isComment)) return false;
    for (let k = 0; k < parts.length; k++) if (parts[k].startPosition.row !== row + 1 + k || parts[k].endPosition.row !== parts[k].startPosition.row) return false;
    const last = parts[parts.length - 1], after = ks[ks.indexOf(ks.find(x => x.startIndex === last.startIndex)) + 1];
    const close = ks[ks.length - 1];
    return !!after && after.type === ',' && after.startPosition.row === last.endPosition.row && close.type === '}' && close.startPosition.row === last.endPosition.row + 1 && call.endPosition.row === close.startPosition.row && call.endIndex === close.endIndex + 1;
  }
  /* Are the items of a bracketed list (an import's { … }, a call's ( … )) one per line, after the line it opens on,
     each on a line of its own (and a comma after the last when trailing is true), the closing bracket on the line
     after the last?
       console.error(           import {
         "Not found:",            Card,
         path                     CardContent,
       );                       } from "@/components/ui/card"; */
  function itemsOnLines(list, items, trailing) {
    const ks = kids(list), open = ks[0], close = ks[ks.length - 1];
    if (!items.length || ks.some(isComment) || !open || !close) return false;
    for (let k = 0; k < items.length; k++) if (items[k].startPosition.row !== open.startPosition.row + 1 + k || items[k].endPosition.row !== items[k].startPosition.row) return false;
    const last = items[items.length - 1], after = ks[ks.findIndex(x => x.startIndex === last.startIndex) + 1];
    const end = trailing ? (after && after.type === ',' && after.startPosition.row === last.endPosition.row ? ks[ks.indexOf(after) + 1] : null) : after;
    return !!end && end === close && close.startPosition.row === last.endPosition.row + 1;
  }
  /* The call a statement is, or gives back, or stores, or waits for (its whole value), or null. */
  function callOf(n) {
    let v = n.type === 'expression_statement' || n.type === 'return_statement' ? real(n)[0]
      : n.type === 'lexical_declaration' && real(n).length === 1 && real(n)[0].type === 'variable_declarator' ? F(real(n)[0], 'value') : null;
    if (v && v.type === 'await_expression') v = real(v)[0];
    return v && v.type === 'call_expression' && F(v, 'arguments') && F(v, 'arguments').type === 'arguments' && !kids(v).some(k => k.type === 'optional_chain') ? v : null;
  }
  // a record's key that would read as a kind of line of its own (ts: exact code, note: a comment), not as a part.
  // (description: is a part there: toast's own, and a tool's description only goes right under its "define")
  const LINE_WORD = /^(?:js|javascript|raw|ts|tsx|note|comment)$/i;
  // a line under "… with:" that is one part of a record, not an input: name: value, "name": value
  const PART_LINE = /^(?:[A-Za-z_$][\w$]*|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\d+):\s/;

  /* ---------- Types ---------- */

  const PREDEF = { number: 'a number', string: 'text', boolean: 'true or false', any: 'anything', unknown: 'something unknown', object: 'an object' };
  const LIST_OF = { number: 'numbers', string: 'text', boolean: 'true or false', any: 'anything' };
  const typeName = (t) => (t && (t.type === 'type_identifier' || (t.type === 'nested_type_identifier' && /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+$/.test(t.text))) ? t.text : null);
  const flatUnion = (t) => (t.type === 'union_type' ? real(t).flatMap(flatUnion) : [t]);

  /* A type in words. pos: 'ret' (what a tool gives back) and 'promise' (what a promise gives) read "nothing" as
     void, so null is never said there; anywhere else "nothing" is null and void stays code. */
  function sayType(t, pos) {
    if (!t) return null;
    switch (t.type) {
      case 'predefined_type':
        if (t.text === 'void') return pos === 'ret' || pos === 'promise' ? 'nothing' : null;
        return PREDEF[t.text] || null;
      case 'literal_type': {
        const c = real(t)[0];
        if (!c) return null;
        if (c.type === 'null') return pos === 'ret' || pos === 'promise' ? null : 'nothing';
        if (c.type === 'undefined') return 'undefined';
        if (c.type === 'string' && plainQuoted(c.text)) return c.text;
        if (c.type === 'number') return c.text;
        return null;
      }
      case 'type_identifier': case 'nested_type_identifier': { const n = typeName(t); return n && art(n); }
      case 'array_type': {
        const e = real(t)[0];
        const w = e && e.type === 'predefined_type' ? LIST_OF[e.text] : typeName(e);
        return w ? `a list of ${w}` : null;
      }
      case 'union_type': {
        const parts = flatUnion(t).map(p => sayType(p, 'union'));
        if (parts.some(p => p == null || /^a tool\b/.test(p))) return null;
        return `${parts.slice(0, -1).join(', ')} or ${parts[parts.length - 1]}`;
      }
      case 'generic_type': {
        const n = typeName(real(t)[0]), ta = real(t).find(x => x.type === 'type_arguments');
        const as = ta ? real(ta) : [];
        if (!n || !as.length || as.length > 2) return null;
        const ws = as.map(a => sayType(a, n === 'Promise' ? 'promise' : 'arg'));
        if (ws.some(w => w == null || / or |^a tool\b| and /.test(w.replace(/^true or false$/, '')))) return null;
        return `${art(n)} of ${ws.join(' and ')}`;
      }
      case 'function_type': {
        const ps = real(t).find(x => x.type === 'formal_parameters'), r = real(t).filter(x => x !== ps).pop();
        const words = ps ? real(ps).map(p => paramWords(p)) : [];
        const back = sayType(r, 'ret');
        if (words.some(w => w == null) || back == null || / giving back /.test(words.join(' '))) return null;
        return `a tool${words.length ? ' using ' + words.join(', ') : ''} giving back ${back}`;
      }
      default: return null;
    }
  }
  /* A tool's input in words: name, name (a number), name (text, if any), name = 1, name (a number) = 1. */
  function paramWords(p) {
    if (p.type !== 'required_parameter' && p.type !== 'optional_parameter') return null;
    const ks = kids(p);
    // ...inputs: the rest of the inputs, as a list
    const rest = ks[0] && ks[0].type === 'rest_pattern' && real(ks[0]).length === 1 && real(ks[0])[0].type === 'identifier';
    const id = rest ? real(ks[0])[0] : ks[0];
    if (!id || id.type !== 'identifier') return null;
    let type = null, value = null, q = false;
    for (let k = 1; k < ks.length; k++) {
      const c = ks[k];
      if (c.type === '?') q = true;
      else if (c.type === 'type_annotation') type = real(c)[0];
      else if (c.type === '=') { value = ks[k + 1]; k++; }
      else if (!isComment(c)) return null;
    }
    if (p.type === 'optional_parameter' && !q) return null;
    const tw = type ? sayType(type, 'arg') : null;
    if (type && tw == null) return null;
    if (value && (!one1(value.text) || /[()]/.test(value.text) && q)) return null;
    if (rest && (q || value)) return null;
    const inner = [rest ? 'the rest' : null, tw, q ? 'if any' : null].filter(Boolean).join(', ');
    return `${id.text}${inner ? ` (${inner})` : ''}${value ? ` = ${value.text}` : ''}`;
  }
  const typeOfAnnotation = (n) => { const a = n && real(n).find(x => x.type === 'type_annotation'); return a ? real(a)[0] : null; };
  const hasTypes = (fn) => {
    const ps = F(fn, 'parameters') || real(fn).find(x => x.type === 'formal_parameters');
    return !!(real(fn).some(x => x.type === 'type_annotation') || (ps && real(ps).some(p => p.type === 'optional_parameter' || real(p).some(x => x.type === 'type_annotation'))));
  };

  /* ---------- React and JSX: what is shared by the converter and the words ---------- */

  const JSX_TYPES = ['jsx_element', 'jsx_self_closing_element'];
  const unparen = (n) => { while (n && n.type === 'parenthesized_expression' && real(n).length === 1) n = real(n)[0]; return n; };
  const isJsx = (n) => { const u = unparen(n); return !!u && JSX_TYPES.includes(u.type); };
  const hasJsx = (n) => !!n && (JSX_TYPES.includes(n.type) || n.descendantsOfType(JSX_TYPES).length > 0);
  const capital = (s) => /^[A-Z]/.test(s);
  const usualSetter = (n) => 'set' + n[0].toUpperCase() + n.slice(1);
  const plainName = (p) => (p && p.type === 'identifier' ? p.text : p && p.type === 'required_parameter' && real(p).length === 1 && real(p)[0].type === 'identifier' && kids(p).length === 1 ? real(p)[0].text : null);
  const arrowParams = (fn) => (F(fn, 'parameters') ? real(F(fn, 'parameters')) : F(fn, 'parameter') ? [F(fn, 'parameter')] : []);
  const isNull = (n) => { const u = unparen(n); return !!u && u.type === 'null'; };
  // a value a prop can have when it is left out: true, 0, "md", [], a name
  const SIMPLE_DEFAULT = /^(?:true|false|null|-?\d+(?:\.\d+)?|"[^"\\\n]*"|'[^'\\\n]*'|\[\]|\{\}|[A-Za-z_$][\w$.]*)$/;
  // React's events, by the word sentences use (and onSomethingChange: "when something changes")
  const JSX_EVENTS = { onClick: 'clicked', onDoubleClick: 'double-clicked', onChange: 'changed', onInput: 'typed in', onSubmit: 'sent', onFocus: 'focused', onBlur: 'unfocused', onMouseEnter: 'hovered', onKeyDown: 'a key is pressed', onKeyUp: 'a key is released', onScroll: 'scrolled' };
  function eventWords(name) {
    if (JSX_EVENTS[name]) return JSX_EVENTS[name];
    const m = name.match(/^on((?:[A-Z][a-z]+)+)Change$/);
    return m ? `${m[1].replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()} changes` : null;
  }

  /* A component's props: ({ a, b = false }: Props) -> { said: 'a and b = false', type: 'Props' }, () -> { said: '' },
     or null when its inputs aren't props. */
  function propsOf(fn) {
    if (F(fn, 'parameter')) return null;
    const ps = F(fn, 'parameters') || real(fn).find(x => x.type === 'formal_parameters');
    if (!ps) return null;
    const list = real(ps);
    if (!list.length) return { said: '', type: null };
    if (list.length !== 1) return null;
    // ({ a, b }: Props) in TypeScript is a required_parameter; in JavaScript the pattern is the input itself
    const [pat, ann, more] = list[0].type === 'object_pattern' ? [list[0]] : list[0].type === 'required_parameter' ? real(list[0]) : [];
    if (!pat || pat.type !== 'object_pattern' || more || (ann && ann.type !== 'type_annotation') || (list[0].type === 'required_parameter' && kids(list[0]).some(k => k.type === '='))) return null;
    const names = [];
    for (const p of real(pat)) {
      if (p.type === 'shorthand_property_identifier_pattern') names.push(p.text);
      else if (p.type === 'object_assignment_pattern') {
        const [k, v] = real(p);
        if (!k || k.type !== 'shorthand_property_identifier_pattern' || !v || !SIMPLE_DEFAULT.test(v.text)) return null;
        names.push(`${k.text} = ${v.text}`);
      } else return null;
    }
    if (!names.length) return null;
    const t = ann ? typeName(real(ann)[0]) : null;
    if (ann && !t) return null;
    return { said: andList(names), type: t };
  }
  /* The component (or other function) a line is in, for "when Card first appears": its name when it is a
     component's, otherwise "this". */
  function whoOf(n) {
    for (let p = n.parent; p; p = p.parent) {
      if (p.type === 'function_declaration') { const nm = F(p, 'name'); return nm && capital(nm.text) ? nm.text : 'this'; }
      if (p.type === 'arrow_function' || p.type === 'function_expression' || p.type === 'function') {
        if (p.parent && p.parent.type === 'arguments') continue;   // (the effect's own little function)
        const d = p.parent && p.parent.type === 'variable_declarator' ? F(p.parent, 'name') : null;
        return d && d.type === 'identifier' && capital(d.text) ? d.text : 'this';
      }
    }
    return 'this';
  }
  /* Is this return inside a useEffect's function (the effect's clean-up)? */
  const inEffect = (n) => {
    const b = n.parent, fn = b && b.parent, args = fn && fn.parent, call = args && args.parent;
    return !!(b && b.type === 'statement_block' && fn && fn.type === 'arrow_function' && args && args.type === 'arguments' && call && call.type === 'call_expression' && F(call, 'function').text === 'useEffect' && real(args)[0] && real(args)[0].startIndex === fn.startIndex);
  };

  /* ---------- Statements and values ---------- */

  function ext(kind) {
    const typed = kind !== 'js';
    const setters = new Map();   // setCount -> count, from the "keep" sentences said so far

    function ex(n, C) {
      // phrase packs: Supabase queries, TanStack Query (any kind of script)
      if (n.type === 'call_expression') {
        const s = supabaseWords(n, C);
        if (s !== undefined) return s;
        const q = queryWords(n, C);
        if (q !== undefined) return q;
      }
      if (!typed) return undefined;
      if (n.type === 'as_expression') {
        const [v, t] = real(n);
        if (!t || t.type === 'const') return undefined;
        const a = C.ex(v), w = sayType(t, 'arg');
        if (a == null || w == null || / assumed to be /.test(a)) return null;
        return C.W(`${C.opx(a)} assumed to be ${w}`);
      }
      // x! : (x for sure), x is there (not null or undefined), TypeScript is told. Always in brackets: "the result
      // of f with x for sure" could be f's result for sure.
      if (n.type === 'non_null_expression') {
        const a = C.ex(real(n)[0]);
        if (a == null || / for sure\)?$/.test(a)) return null;
        return `(${a} for sure)`;
      }
      return undefined;
    }

    /* A tool's inputs in words (null when one of them stays code). */
    const paramsOf = (fn) => { const ps = F(fn, 'parameters') || real(fn).find(x => x.type === 'formal_parameters'); if (!ps) return null; const w = real(ps).map(paramWords); return w.some(x => x == null) ? null : w; };

    /* A call written over lines, the whole value of its statement: its inputs one per line, or its last input a
       record a part per line. Said as the sentence it is on one line, its inputs (or the record's parts) taken off
       the end and put a line each under it:
         run console.error with:           run toast with:                 wait for fetch with "/api" and:
             "Not found:"                      title: "Saved"                  method: "POST"
             path                              variant: "destructive"          body: note as JSON text
       undefined: not one of these (or not said so), and the statement is said the usual way. */
    const busy = new Set();
    function callOnLines(n, depth, lvl, C) {
      // (TypeScript and React only: their layout is what comes back; a website's JavaScript keeps its own sentences)
      if (!typed || lvl || busy.has(n.startIndex)) return undefined;
      const call = callOf(n);
      if (!call || real(call).some(x => x.type === 'type_arguments')) return undefined;
      const al = F(call, 'arguments'), a = C.args(call), obj = a.length && a[a.length - 1].type === 'object' ? a[a.length - 1] : null;
      const parts = obj ? real(obj) : [];
      const record = !!obj && onLines(call, obj, parts) && parts.some(p => p.type === 'pair');
      if (!record && !(kids(al)[0].startPosition.row === call.startPosition.row && itemsOnLines(al, a, false))) return undefined;
      // what goes under it: the record's parts, or the inputs, as the one-line sentence says them
      const under = [];
      for (const p of record ? parts : a) {
        let w;
        if (!record) w = C.item(C.ex(p));
        else if (p.type === 'shorthand_property_identifier') w = p.text;
        else if (p.type === 'pair' && /^(?:property_identifier|string|number)$/.test(F(p, 'key').type) && !LINE_WORD.test(F(p, 'key').text)) { const v = C.inList(C.ex(F(p, 'value'))); w = v == null ? null : `${F(p, 'key').text}: ${v}`; }
        if (w == null || /\n/.test(w) || (!record && PART_LINE.test(w))) return undefined;
        under.push(w);
      }
      // the sentence on one line (a record given over lines is never too long a sentence, nor a fetch a "send")
      const tail = record ? `{ ${under.join(', ')} }` : under.join(', ');
      busy.add(n.startIndex); C.lined.add(call.startIndex); if (obj) C.lined.add(obj.startIndex);
      const m = C.o.mark(), at = C.o.lines.length;
      let ok = false;
      try { ok = C.one(n, depth, 0); } catch (e) { ok = false; } finally { busy.delete(n.startIndex); }
      const got = C.o.lines.slice(at).map(l => l.trim());
      C.o.undo(m);
      const head = ok && got.length === 1 && got[0].endsWith(tail) ? got[0].slice(0, -tail.length) : null;
      const said = head == null ? null : / with $/.test(head) ? head.trimEnd() + ':' : record && /, $/.test(head) ? head.slice(0, -2) + ' and:' : null;
      if (!said) { C.lined.delete(call.startIndex); if (obj) C.lined.delete(obj.startIndex); return undefined; }
      C.o.say(depth, [said, ...under.map(w => IND + w)].join('\n'));
      return true;
    }

    function one(n, depth, lvl, C) {
      const say = (t) => { C.o.say(depth, t); return true; };
      const lc = callOnLines(n, depth, lvl, C);
      if (lc !== undefined) return lc;
      const r = react(n, depth, lvl, C);
      if (r !== undefined) return r;
      switch (n.type) {
        case 'lexical_declaration': {
          if (!typed) return undefined;
          const d = real(n).filter(x => x.type === 'variable_declarator');
          if (d.length !== 1) return undefined;
          const name = F(d[0], 'name'), v = F(d[0], 'value'), t = typeOfAnnotation(d[0]);
          const constant = kids(n)[0].type === 'const';
          // a little tool with typed inputs: "constant handle is a tool using e (a React.FormEvent)"
          if (!t && v && v.type === 'arrow_function' && !lvl && name.type === 'identifier' && hasTypes(v)) {
            if (real(v).some(x => x.type === 'type_annotation' || x.type === 'type_parameters')) return false;
            const ps = paramsOf(v), body = F(v, 'body');
            if (!ps || !body) return false;
            const head = `${constant ? 'constant' : 'set'} ${name.text} ${constant ? 'is' : 'to'} a tool${ps.length ? ' using ' + ps.join(', ') : ''}`;
            if (body.type === 'statement_block') { say(head); C.inside(null, () => C.block(real(body), depth + 1, n.startIndex)); return true; }
            const g = C.val(body);
            return g != null && !/\sgiving back\s/.test(g) && say(`${head} giving back ${g}`);
          }
          if (!t) return undefined;
          if (name.type !== 'identifier' || !v) return false;
          const w = sayType(t, 'arg'), e = C.val(v);
          if (w == null || e == null) return false;
          return say(constant ? `constant ${name.text} (${w}) is ${e}` : `set ${name.text} (${w}) to ${e}`);
        }
        case 'function_declaration': {
          if (!typed || !hasTypes(n)) return undefined;
          if (real(n).some(x => x.type === 'type_parameters') || has(n, '*')) return false;
          const ps = paramsOf(n);
          const rt = real(n).find(x => x.type === 'type_annotation');
          const back = rt ? sayType(real(rt)[0], 'ret') : null;
          if (!ps || (rt && back == null)) return false;
          say(`define ${F(n, 'name').text}${ps.length ? ' using ' + ps.join(', ') : ''}${back ? ' giving back ' + back : ''}`);
          C.inside(null, () => C.block(real(F(n, 'body')), depth + 1, n.startIndex));
          return true;
        }
        // define shape Note (an interface), its parts indented under it: "id is text", "read-only created is a Date"
        case 'interface_declaration': {
          if (!typed || lvl) return false;
          const name = real(n).find(x => x.type === 'type_identifier'), ext_ = real(n).find(x => x.type === 'extends_type_clause'), body = real(n).find(x => x.type === 'interface_body' || x.type === 'object_type');
          if (!name || !body || real(n).some(x => x.type === 'type_parameters')) return false;
          const bases = ext_ ? real(ext_).map(typeName) : [];
          if (bases.some(b => b == null)) return false;
          say(`define shape ${name.text}${bases.length ? ' based on ' + andList(bases) : ''}`);
          shapeParts(body, depth + 1, n.startIndex, C);
          return true;
        }
        // define type Filter as "all", "open" or "done"; define type Props as a shape (its parts indented under it)
        case 'type_alias_declaration': {
          if (!typed || lvl) return false;
          const name = real(n).find(x => x.type === 'type_identifier'), t = real(n).filter(x => x !== name && x.type !== 'type_parameters').pop();
          if (!name || !t || real(n).some(x => x.type === 'type_parameters')) return false;
          if (t.type === 'object_type') { say(`define type ${name.text} as a shape`); shapeParts(t, depth + 1, n.startIndex, C); return true; }
          const w = sayType(t, 'arg');
          return w != null && say(`define type ${name.text} as ${w}`);
        }
        // bring in: the main part of a file (import X), everything (import * as N), names as others (a as b), types,
        // and a file for what it does (import "./index.css"). Plain names are the JavaScript sentence.
        case 'import_statement': {
          const clause = real(n).find(x => x.type === 'import_clause'), from = real(n).find(x => x.type === 'string');
          if (!from || !plainQuoted(from.text)) return false;
          if (!clause) return kids(n).length <= 3 && say(`bring in ${from.text}`);
          const parts = real(clause), only = has(n, 'type');
          if (only && !typed) return false;
          if (parts.length === 1 && parts[0].type === 'namespace_import' && !only) {
            const nm = real(parts[0])[0];
            return !!nm && say(`bring in everything from ${from.text} as ${nm.text}`);
          }
          const main = parts[0].type === 'identifier' ? parts[0] : null, list = parts.find(x => x.type === 'named_imports');
          if (parts.length !== (main ? 1 : 0) + (list ? 1 : 0) || (only && main)) return false;
          const items = [];
          if (main) items.push(`${main.text} (the main part)`);
          for (const s of list ? real(list) : []) {
            if (s.type !== 'import_specifier') return false;
            const ks = kids(s), t = ks[0].type === 'type';
            if (t && !typed) return false;
            const ids = real(s);
            if (!ids.length || ids.length > 2 || ids.some(x => x.type !== 'identifier')) return false;
            items.push(`${t ? 'the type ' : ''}${ids[0].text}${ids[1] ? ' as ' + ids[1].text : ''}`);
          }
          if (only) return items.length > 0 && !items.some(x => / as /.test(x)) && say(`bring in the type${items.length > 1 ? 's' : ''} ${andList(items)} from ${from.text}`);
          // the names one per line (as Prettier writes a long list): "bring in from "…":", a name a line under it
          if (typed && !main && list && list.startPosition.row === n.startPosition.row && itemsOnLines(list, real(list), true)) return say([`bring in from ${from.text}:`, ...items.map(x => IND + x)].join('\n'));
          // ("bring in the type A …" is a list of types only, so a list can't start with one when it has other names)
          if (/^the type /.test(items[0])) return false;
          // (plain names, "bring in a and b from …", are JavaScript's own sentence)
          if (!main && items.every(x => !/ /.test(x))) return undefined;
          return items.length > 0 && say(`bring in ${andList(items)} from ${from.text}`);
        }
        // shared (export) and main (export default): said on the line the thing is made with
        case 'export_statement': {
          const isDefault = has(n, 'default'), inner = real(n);
          if (inner.length !== 1) return false;
          const d = inner[0];
          if (/^(?:function_declaration|lexical_declaration|class_declaration|interface_declaration|type_alias_declaration)$/.test(d.type)) {
            if (isDefault && !/^(?:function_declaration|class_declaration)$/.test(d.type)) return false;
            const m = C.o.mark(), at = C.o.lines.length;
            C.o.parents.set(d.startIndex, n.startIndex);
            if (!C.one(d, depth, lvl)) { C.o.undo(m); return false; }
            const line = C.o.lines[at], pad = line.match(/^ */)[0], t = line.slice(pad.length);
            const word = isDefault ? 'main' : 'shared';
            const said = /^define (?!shared |main )/.test(t) ? t.replace(/^define /, `define ${word} `) : !isDefault && /^constant /.test(t) ? 'shared ' + t : null;
            if (!said) { C.o.undo(m); return false; }
            C.o.lines[at] = pad + said;
            return true;
          }
          if (isDefault && d.type === 'identifier') return say(`share ${d.text} as the main part`);
          if (!isDefault && d.type === 'export_clause' && kids(n).length <= 3) {
            const specs = real(d);
            if (!specs.length || specs.some(s => s.type !== 'export_specifier' || kids(s).length !== 1)) return false;
            return say(`share ${andList(specs.map(s => s.text))}`);
          }
          return false;
        }
        // an if with its one step on the same line, if (error) throw error;: "if error, fail with error as it is".
        // (Checked like the rest; if the check finds it differs, it is said as an if with its step under it.)
        case 'if_statement': {
          const cons = F(n, 'consequence'), cond = F(n, 'condition');
          if (!typed || F(n, 'alternative') || !cons || !cond || cons.type === 'statement_block' || cons.startPosition.row !== n.startPosition.row || cons.endPosition.row !== n.endPosition.row) return undefined;
          const c = C.ex(real(cond)[0]);
          if (c == null) return false;
          if (lvl) {   // the check found the one line differs: the if with its step under it, as JavaScript says it
            say(`if ${c}`);
            C.block(C.bodyOf(cons), depth + 1, n.startIndex);
            return true;
          }
          const m = C.o.mark(), at = C.o.lines.length;
          C.o.parents.set(cons.startIndex, n.startIndex);
          C.o.keyStack.push(cons.startIndex);
          let ok = false;
          try { ok = C.one(cons, depth + 1, 0); } catch (e) { ok = false; }
          C.o.keyStack.pop();
          const got = C.o.lines.slice(at).map(l => l.trim());
          C.o.undo(m);
          if (!ok || got.length !== 1 || !IF_STEP.test(got[0])) return undefined;
          C.o.careful.add(n.startIndex);
          return say(`if ${c}, ${got[0]}`);
        }
        default: return undefined;
      }
    }

    /* The parts of a shape, one line each (comments as notes, anything else as code). */
    function shapeParts(body, depth, key, C) {
      C.walk(real(body).filter(x => x.type !== ',' && x.type !== ';'), depth, key, (p, d) => {
        if (p.type !== 'property_signature') return false;
        const ks = kids(p);
        let ro = false, q = false, name = null, t = null;
        for (const k of ks) {
          if (k.type === 'readonly') ro = true;
          else if (k.type === 'property_identifier') name = k.text;
          else if (k.type === '?') q = true;
          else if (k.type === 'type_annotation') t = real(k)[0];
          else if (!isComment(k)) return false;
        }
        const w = t ? sayType(t, 'arg') : null;
        if (!name || w == null) return false;
        C.o.say(d, `${ro ? 'read-only ' : ''}${name} is ${w}${q ? ', if any' : ''}`);
        return true;
      });
    }

    /* ---------- Phrase packs: Supabase and TanStack Query ---------- */

    /* supabase.from("notes").select("*").eq("id", id).order("created_at", { ascending: false }) -> every row of the
       "notes" table in supabase where "id" is id sorted by "created_at" from the end. undefined: not a query. */
    const SUPA_MODS = / where | sorted by | at most | giving back | as a single row| as one row or none/;
    function supabaseWords(n, C) {
      const calls = [];
      let cur = n;
      while (cur && cur.type === 'call_expression') {
        const fn = F(cur, 'function');
        if (!fn || fn.type !== 'member_expression' || kids(fn).some(k => k.type === 'optional_chain') || real(cur).some(x => x.type === 'type_arguments') || !F(cur, 'arguments') || F(cur, 'arguments').type !== 'arguments') return undefined;
        calls.unshift({ m: F(fn, 'property').text, a: C.args(cur) });
        cur = F(fn, 'object');
      }
      if (!cur || cur.type !== 'identifier' || calls.length < 2 || calls[0].m !== 'from' || calls[0].a.length !== 1 || !C.plainString(calls[0].a[0])) return undefined;
      const val = (x) => { const v = C.ex(x); return v == null || SUPA_MODS.test(` ${v} `) || /\n/.test(v) ? null : C.item(v); };
      const where = `the ${calls[0].a[0].text} table in ${cur.text}`;
      const [h, ...mods] = calls.slice(1);
      let said;
      if (h.m === 'select' && h.a.length === 1 && C.plainString(h.a[0])) said = h.a[0].text.slice(1, -1) === '*' ? `every row of ${where}` : `the ${h.a[0].text} of every row of ${where}`;
      else if (h.m === 'insert' && h.a.length === 1) { const v = val(h.a[0]); said = v && `adding ${v} to ${where}`; }
      else if (h.m === 'update' && h.a.length === 1) { const v = val(h.a[0]); said = v && `changing ${v} in ${where}`; }
      else if (h.m === 'upsert' && h.a.length === 1) { const v = val(h.a[0]); said = v && `adding or replacing ${v} in ${where}`; }
      else if (h.m === 'delete' && !h.a.length) said = `deleting from ${where}`;
      if (!said) return null;
      const more = [];
      for (const md of mods) {
        const [a0, a1] = md.a;
        if ((md.m === 'eq' || md.m === 'neq') && md.a.length === 2 && C.plainString(a0)) { const v = val(a1); if (!v) return null; more.push(`where ${a0.text} is${md.m === 'neq' ? ' not' : ''} ${v}`); }
        else if (md.m === 'order' && C.plainString(a0) && (md.a.length === 1 || (md.a.length === 2 && /^\{\s*ascending:\s*(?:true|false)\s*,?\s*\}$/.test(a1.text)))) more.push(`sorted by ${a0.text}${md.a.length === 2 ? (/false/.test(a1.text) ? ' from the end' : ' from the start') : ''}`);
        else if (md.m === 'limit' && md.a.length === 1 && a0.type === 'number') more.push(`at most ${a0.text}`);
        else if (md.m === 'select' && !md.a.length) more.push('giving back the result');
        else if (md.m === 'single' && !md.a.length) more.push('as a single row');
        else if (md.m === 'maybeSingle' && !md.a.length) more.push('as one row or none');
        else return null;
      }
      // one call a line (supabase, then .from(…), .select(…) and each one after it on a line of its own): each part
      // after the table on a line of its own under the sentence
      return C.W(typed && more.length && chainOnLines(n, cur) ? [said,...more.map(x => IND + x)].join('\n') : [said, ...more].join(' '));
    }
    /* Is the chain on cur (supabase) written one call per line, the whole value of its statement?
         const { data, error } = await supabase
           .from("notes")
           .select("*")
           .order("created_at", { ascending: false }); */
    function chainOnLines(n, cur) {
      const p = n.parent && n.parent.type === 'await_expression' ? n.parent.parent : n.parent;
      if (!p || !/^(?:return_statement|variable_declarator|expression_statement)$/.test(p.type)) return false;
      const calls = [];
      // (nodes are compared by where they are: the reader gives a new object each time it is asked for one)
      for (let c = n; c && c.type === 'call_expression' && c.startIndex === cur.startIndex && c.endIndex !== cur.endIndex; c = F(F(c, 'function'), 'object')) calls.unshift(c);
      if (!calls.length) return false;
      const row = cur.endPosition.row;
      return calls.every((c, k) => {
        const fn = F(c, 'function'), dot = kids(fn).find(x => x.type === '.');
        return !!dot && dot.startPosition.row === row + 1 + k && c.endPosition.row === row + 1 + k;
      });
    }
    /* useQuery({ queryKey: ["notes"], queryFn: fetchNotes }) -> the query ["notes"] loaded by fetchNotes;
       useMutation({ mutationFn: f }) -> a change made by f. A query written one part per line (as Lovable and
       Prettier write it) is said that way too, when it is a statement's whole value: "… the query ["notes"]" with
       "loaded by fetchNotes" on the line under it. */
    function queryWords(n, C) {
      const fn = F(n, 'function'), a = C.args(n);
      if (!fn || fn.type !== 'identifier' || !/^use(?:Query|Mutation)$/.test(fn.text) || real(n).some(x => x.type === 'type_arguments')) return undefined;
      const o = a.length === 1 && a[0].type === 'object' ? real(a[0]) : null;
      const pair = (p, k) => p && p.type === 'pair' && F(p, 'key').text === k ? F(p, 'value') : null;
      if (!o) return null;
      if (fn.text === 'useQuery' && o.length === 2 && pair(o[0], 'queryKey') && pair(o[1], 'queryFn')) {
        const k = C.ex(pair(o[0], 'queryKey')), f = C.ex(pair(o[1], 'queryFn'));
        if (k == null || f == null || / loaded by /.test(k + ' ' + f) || /\n/.test(k + f)) return null;
        return C.W(onLines(n, a[0], o) ? `the query ${k}\n${IND}loaded by ${f}` : `the query ${k} loaded by ${f}`);
      }
      if (fn.text === 'useMutation' && o.length === 1 && pair(o[0], 'mutationFn')) {
        const f = C.ex(pair(o[0], 'mutationFn'));
        return f == null || /\n/.test(f) ? null : C.W(`a change made by ${f}`);
      }
      return null;
    }
    /* return useMutation({ mutationFn: f, onSuccess: () => { … } }): "give back a change made by f", with "when it
       works" (and "when it fails") under it. */
    function mutationBlock(n, depth, C) {
      const call = real(n)[0];
      if (!call || call.type !== 'call_expression' || F(call, 'function').text !== 'useMutation' || real(call).some(x => x.type === 'type_arguments')) return undefined;
      const a = C.args(call), o = a.length === 1 && a[0].type === 'object' ? real(a[0]) : null;
      if (!o || o.length < 2 || o.some(p => p.type !== 'pair')) return undefined;
      const [first, ...rest] = o;
      if (F(first, 'key').text !== 'mutationFn' || rest.some(p => !/^on(?:Success|Error)$/.test(F(p, 'key').text))) return false;
      const f = C.ex(F(first, 'value'));
      if (f == null || /\n/.test(f)) return false;
      C.o.say(depth, `give back a change made by ${f}`);
      for (const p of rest) {
        const h = F(p, 'value'), word = F(p, 'key').text === 'onSuccess' ? 'works' : 'fails';
        if (!h || h.type !== 'arrow_function' || arrowParams(h).length || has(h, 'async')) return false;
        const body = F(h, 'body');
        if (body.type === 'statement_block') { C.o.say(depth + 1, `when it ${word}`); C.inside(null, () => C.block(real(body), depth + 2, n.startIndex)); }
        else { const w = inlineWords(body, C); if (!w) return false; C.o.say(depth + 1, `when it ${word}, ${w}`); }
      }
      return true;
    }

    /* ---------- React: components, state, effects, references, and what they show ---------- */

    function react(n, depth, lvl, C) {
      const say = (t) => { C.o.say(depth, t); return true; };
      switch (n.type) {
        // define component Card using title and children from CardProps
        case 'function_declaration': {
          const name = F(n, 'name'), body = F(n, 'body');
          if (!name || !capital(name.text) || !hasJsx(body) || has(n, 'async') || has(n, '*') || real(n).some(x => x.type === 'type_parameters' || x.type === 'type_annotation')) return undefined;
          const pr = propsOf(n);
          if (!pr || (pr.type && !typed)) return undefined;
          say(`define component ${name.text}${pr.said ? ' using ' + pr.said : ''}${pr.type ? ' from ' + pr.type : ''}`);
          C.inside(null, () => C.block(real(body), depth + 1, n.startIndex));
          return true;
        }
        case 'lexical_declaration': {
          const d = real(n).filter(x => x.type === 'variable_declarator');
          if (d.length !== 1 || kids(n)[0].type !== 'const' || real(d[0]).some(x => x.type === 'type_annotation')) return undefined;
          const pat = F(d[0], 'name'), v = F(d[0], 'value');
          if (!pat || !v) return undefined;
          // constant Index is a component (its steps under it), or ", showing:" with what it shows under it
          if (pat.type === 'identifier' && capital(pat.text) && v.type === 'arrow_function' && !has(v, 'async') && hasJsx(F(v, 'body')) && !real(v).some(x => x.type === 'type_annotation' || x.type === 'type_parameters')) {
            const pr = propsOf(v), body = F(v, 'body');
            if (!pr || (pr.type && !typed) || lvl) return undefined;
            const head = `constant ${pat.text} is a component${pr.said ? ' using ' + pr.said : ''}${pr.type ? ' from ' + pr.type : ''}`;
            if (body.type === 'statement_block') { say(head); C.inside(null, () => C.block(real(body), depth + 1, n.startIndex)); return true; }
            if (!isJsx(body)) return undefined;
            // (const A = () => <p>Hi</p>; on one line: "…, showing: a paragraph saying "Hi"")
            const one = JSX_TYPES.includes(body.type) ? oneLineJsx(body, depth, n.startIndex, C) : null;
            if (one) return say(`${head}, showing: ${one}`);
            say(head + ', showing:');
            return jsxChild(unparen(body), depth + 1, n.startIndex, C);
          }
          const call = v.type === 'call_expression' && F(v, 'arguments') && F(v, 'arguments').type === 'arguments' && !kids(v).some(k => k.type === 'optional_chain') ? v : null;
          const fn = call && F(call, 'function'), a = call ? C.args(call) : [];
          const ta = call && real(call).find(x => x.type === 'type_arguments'), targs = ta ? real(ta) : [];
          // keep count, starting at 0 (useState), its type and setter said when they are there
          if (pat.type === 'array_pattern' && fn && fn.text === 'useState' && a.length <= 1 && targs.length <= 1) {
            const ns = real(pat);
            if (ns.length !== 2 || ns.some(x => x.type !== 'identifier') || kids(pat).filter(k => k.type === ',').length !== 1) return false;
            const [s, set] = ns.map(x => x.text);
            const tw = targs.length ? sayType(targs[0], 'arg') : null;
            if (targs.length && (tw == null || !typed)) return false;
            const start = a.length ? C.val(a[0]) : null;
            if (a.length && (start == null || /,\s+changed with\s/.test(start))) return false;
            setters.set(set, s);
            return say(`keep ${s}${tw ? ` (${tw})` : ''}, ${a.length ? `starting at ${start}` : 'with no starting value'}${set === usualSetter(s) ? '' : `, changed with ${set}`}`);
          }
          // keep a reference inputRef (to an HTMLInputElement), starting at nothing (useRef)
          if (pat.type === 'identifier' && fn && fn.text === 'useRef' && a.length <= 1 && targs.length <= 1) {
            const tw = targs.length ? sayType(targs[0], 'arg') : null;
            if (targs.length && (tw == null || !typed)) return false;
            const start = a.length ? C.val(a[0]) : null;
            if (a.length && start == null) return false;
            return say(`keep a reference ${pat.text}${tw ? ` (to ${tw})` : ''}${a.length ? `, starting at ${start}` : ''}`);
          }
          // constant visible is …, worked out again whenever notes or filter changes (useMemo)
          if (pat.type === 'identifier' && fn && fn.text === 'useMemo' && a.length === 2 && !targs.length && a[0].type === 'arrow_function' && !arrowParams(a[0]).length && !has(a[0], 'async') && a[1].type === 'array' && F(a[0], 'body').type !== 'statement_block') {
            const e = C.val(F(a[0], 'body')), deps = real(a[1]).map(x => C.ex(x));
            if (e == null || deps.some(x => x == null || / or /.test(x)) || /, worked out /.test(e)) return false;
            return say(`constant ${pat.text} is ${e}, worked out ${deps.length ? `again whenever ${deps.join(' or ')} changes` : 'once'}`);
          }
          // take toast from the result of useToast (const { toast } = …); a part as another name, and its value when
          // it's missing: take data as notes (or an empty list) and isLoading from …; "wait for …, and take … from it"
          if (pat.type === 'object_pattern') {
            const items = [];
            const or = (x) => { const d = C.val(x); return d == null || /[()]/.test(d) && !C.simple(d) ? null : ` (or ${d})`; };
            for (const x of real(pat)) {
              if (x.type === 'shorthand_property_identifier_pattern') { items.push(x.text); continue; }
              if (x.type === 'object_assignment_pattern') { const [k, d] = real(x), w = k && k.type === 'shorthand_property_identifier_pattern' ? or(d) : null; if (!w) return false; items.push(k.text + w); continue; }
              if (x.type === 'pair_pattern') {
                const k = F(x, 'key'), to = F(x, 'value');
                if (!k || k.type !== 'property_identifier' || !to) return false;
                if (to.type === 'identifier') { items.push(`${k.text} as ${to.text}`); continue; }
                if (to.type === 'assignment_pattern' && F(to, 'left').type === 'identifier') { const w = or(F(to, 'right')); if (!w) return false; items.push(`${k.text} as ${F(to, 'left').text}${w}`); continue; }
              }
              return false;
            }
            if (!items.length) return false;
            if (v.type === 'await_expression') {
              const w = C.val(real(v)[0]);
              if (w == null || /,? and take /.test(w)) return false;
              // (a value that goes on over the lines under it, a query's parts: what it takes goes on the first line)
              const [first, ...under] = w.split('\n');
              return say([`wait for ${first}, and take ${andList(items)} from it`, ...under].join('\n'));
            }
            const e = C.val(v);
            return e != null && say(`take ${andList(items)} from ${e}`);
          }
          return undefined;
        }
        case 'expression_statement': {
          const e = real(n)[0];
          // wait for deleting from the "notes" table in supabase where "id" is id (a query waited for, its answer unused)
          const q = e && e.type === 'await_expression' && real(e)[0] && real(e)[0].type === 'call_expression' ? supabaseWords(real(e)[0], C) : undefined;
          if (q !== undefined) return q != null && say(`wait for ${q}`);
          if (!e || e.type !== 'call_expression') return undefined;
          const fn = F(e, 'function'), a = C.args(e);
          // when Card first appears / whenever query changes (useEffect), its steps under it
          if (fn.text === 'useEffect') {
            const f = a[0];
            if (a.length !== 2 || !f || f.type !== 'arrow_function' || has(f, 'async') || arrowParams(f).length || F(f, 'body').type !== 'statement_block' || a[1].type !== 'array') return false;
            const deps = real(a[1]).map(x => C.ex(x));
            if (deps.some(x => x == null || / or /.test(x))) return false;
            say(deps.length ? `whenever ${deps.join(' or ')} changes` : `when ${whoOf(n)} first appears`);
            C.inside(null, () => C.block(real(F(f, 'body')), depth + 1, n.startIndex));
            return true;
          }
          // change count to count plus 1 (a state's setter); mark the query … as out of date (TanStack Query)
          if ((fn.type === 'identifier' && setters.has(fn.text)) || (fn.type === 'member_expression' && F(fn, 'property').text === 'invalidateQueries')) { const w = inlineWords(e, C); return w ? say(w) : false; }
          // the app's start: show an App in (the element called "root") for sure (React DOM's createRoot … render)
          const r0 = fn.type === 'member_expression' && F(fn, 'property').text === 'render' ? F(fn, 'object') : null;
          if (r0 && r0.type === 'call_expression' && F(r0, 'function').text === 'createRoot' && C.args(r0).length === 1 && a.length === 1 && a[0].type === 'jsx_self_closing_element' && real(a[0]).length === 1 && /^[A-Z][\w$]*$/.test(real(a[0])[0].text)) {
            const at = C.ex(C.args(r0)[0]);
            return at != null && say(`show ${art(real(a[0])[0].text)} in ${at}`);
          }
          return undefined;
        }
        case 'throw_statement': {
          // throw error: an error there already, passed on as it is (fail with … is throw new Error(…))
          const v = real(n)[0];
          if (!v || v.type === 'new_expression') return undefined;
          const e = C.ex(v);
          return e != null && !/ as it is$/.test(e) && say(`fail with ${e} as it is`);
        }
        case 'return_statement': {
          const v = real(n)[0];
          if (!v) return undefined;
          const mb = mutationBlock(n, depth, C);
          if (mb !== undefined) return mb;
          // show: what a component shows, under it; or after it, on one line, when the code gives it back on its
          // line without brackets: return <p>Loading…</p>; is "show: a paragraph saying "Loading…""
          if (isJsx(v)) {
            const one = !lvl && JSX_TYPES.includes(v.type) ? oneLineJsx(v, depth, n.startIndex, C) : null;
            if (one) { C.o.careful.add(n.startIndex); return say(`show: ${one}`); }
            say('show:');
            return jsxChild(unparen(v), depth + 1, n.startIndex, C);
          }
          // when Card goes away (an effect's clean-up)
          if (v.type === 'arrow_function' && inEffect(n) && !arrowParams(v).length && !has(v, 'async')) {
            const body = F(v, 'body');
            if (body.type === 'statement_block') { say(`when ${whoOf(n)} goes away`); C.inside(null, () => C.block(real(body), depth + 1, n.startIndex)); return true; }
            const w = inlineWords(body, C);
            return !!w && say(`when ${whoOf(n)} goes away, ${w}`);
          }
          return undefined;
        }
        default: return undefined;
      }
    }

    /* One step as words, for a handler written in place (onClick={() => …}) or a clean-up: change a state, show,
       or run a tool. null when it isn't one of these. */
    function inlineWords(e, C) {
      if (!e || e.type !== 'call_expression' || !F(e, 'arguments') || F(e, 'arguments').type !== 'arguments' || kids(e).some(k => k.type === 'optional_chain') || real(e).some(x => x.type === 'type_arguments')) return null;
      const fn = F(e, 'function'), a = C.args(e);
      // queryClient.invalidateQueries({ queryKey: ["notes"] }): mark the query ["notes"] in queryClient as out of date
      if (fn.type === 'member_expression' && F(fn, 'property').text === 'invalidateQueries' && a.length === 1 && a[0].type === 'object' && real(a[0]).length === 1) {
        const p = real(a[0])[0], k = p.type === 'pair' && F(p, 'key').text === 'queryKey' ? C.ex(F(p, 'value')) : null, q = C.ex(F(fn, 'object'));
        if (k != null && q != null && C.isChain(F(fn, 'object')) && !/\sas out of date|\sin\s/.test(k)) return `mark the query ${k} in ${q} as out of date`;
      }
      const state = fn.type === 'identifier' ? setters.get(fn.text) : null;
      if (state && a.length === 1) {
        const arg = a[0];
        if (arg.type === 'arrow_function' && !has(arg, 'async')) {
          const ps = arrowParams(arg), p = ps.length === 1 ? plainName(ps[0]) : null, body = F(arg, 'body');
          if (!p || body.type === 'statement_block') return null;
          const v = C.val(body);
          return v == null ? null : `change ${state} from ${p} to ${v}`;
        }
        const v = C.val(arg);
        return v == null ? null : `change ${state} to ${v}`;
      }
      if (fn.text === 'console.log' && a.length) { const v = C.rest(a); return v.some(x => x == null) ? null : `show ${v.join(', ')}`; }
      if (!C.isChain(fn)) return null;
      const v = C.rest(a);
      return v.some(x => x == null) ? null : `run ${fn.text}${v.length ? ' with ' + v.join(', ') : ''}`;
    }

    /* A prop as a setting after a comma: styled "p-4", keyed by note.id, running save when clicked, when clicked:
       run save, with variant "ghost", with checked {note.done}, with everything in props. null: it stays code. */
    function propWords(a, C) {
      if (a.type === 'jsx_expression') {
        const sp = real(a)[0];
        if (real(a).length !== 1 || !sp || sp.type !== 'spread_element') return null;
        const v = C.ex(real(sp)[0]);
        return v == null || /[,\n]/.test(v) ? null : `with everything in ${v}`;
      }
      if (a.type !== 'jsx_attribute') return null;
      const [nameN, val, more] = real(a);
      if (!nameN || nameN.type !== 'property_identifier' || more) return null;
      const name = nameN.text;
      if (!val) return `with ${name}`;
      if (val.type === 'string') {
        if (/\n/.test(val.text)) return null;
        // Tailwind's classes in words, when every one of them has words (or is said as written, in quotes)
        const tw = name === 'className' && C.TS && C.TS.tailwindWords ? C.TS.tailwindWords(val.text.slice(1, -1)) : null;
        if (tw) return `styled as ${tw}`;
        return name === 'className' ? `styled ${val.text}` : `with ${name} ${val.text}`;
      }
      if (val.type !== 'jsx_expression' || real(val).length !== 1) return null;
      const e = real(val)[0];
      if (isComment(e)) return null;
      const ev = eventWords(name);
      if (ev) {
        if (C.isChain(e)) return `running ${e.text} when ${ev}`;
        if (e.type === 'arrow_function' && !has(e, 'async')) {
          const ps = arrowParams(e), p = ps.length === 1 ? plainName(ps[0]) : null, body = F(e, 'body');
          if (ps.length > 1 || (ps.length && !p) || body.type === 'statement_block') return null;
          const w = inlineWords(body, C);
          if (w) return `when ${ev}${p ? ' with ' + p : ''}: ${w}`;
        }
      }
      const v = C.ex(e);
      if (v == null || /\n/.test(v)) return null;
      if (name === 'key') return `keyed by ${v}`;
      return name === 'className' ? `styled {${v}}` : `with ${name} {${v}}`;
    }

    /* Children of an element: runs of text and values as one quoted line ("Hi {name}"), a value on its own as {x},
       and each element, "only if", "if … otherwise", "for each" and note on lines of their own. */
    function piecesOf(el, C) {
      const ch = C.jsxChildren(el);
      if (!ch) return null;
      const items = [];
      for (const c of ch) {
        const fill = c.node && c.node.type === 'jsx_expression' ? fillOf(c.node, C) : null;
        const piece = c.text != null ? { text: c.text, k: c.k, end: c.end } : fill != null ? { fill, k: c.node.startIndex, end: c.node.endIndex } : null;
        if (piece) {
          const last = items[items.length - 1];
          if (last && last.run) last.run.push(piece); else items.push({ run: [piece] });
        } else items.push({ node: c.node });
      }
      return items;
    }
    /* A JSX value child ({title}, {count plus 1}) in words, or null for one that is said on its own line. */
    function fillOf(x, C) {
      const inner = real(x);
      if (inner.length !== 1 || isComment(inner[0])) return null;
      const e = inner[0];
      if (e.type === 'string' && e.text.slice(1, -1) === ' ') return null;   // (a space)
      if (hasJsx(e)) return null;
      const v = C.ex(e);
      return v == null || /\n/.test(v) ? null : v;
    }
    /* A run as one line: {x} for a value on its own, "text {x} text" otherwise (null when a value has quotes in it). */
    function runLine(run) {
      if (run.length === 1 && run[0].fill != null) return `{${run[0].fill}}`;
      if (run.some(p => p.fill != null && /["'`]/.test(p.fill))) return null;
      const texts = run.filter(p => p.text != null).map(p => p.text).join('');
      const q = !texts.includes('"') ? '"' : !texts.includes("'") ? "'" : '"';
      const body = run.map(p => (p.fill != null ? `{${p.fill}}` : p.text.replace(/\\/g, '\\\\').replace(/[{}]/g, '$&$&').split(q).join('\\' + q))).join('');
      return q + body + q;
    }

    /* A JSX element (or a child) said at depth, under key; kept as exact code when it can't be said, or the
       check found it differs. */
    function jsxChild(node, depth, parent, C) {
      const key = node.startIndex;
      C.o.parents.set(key, parent);
      const m = C.o.mark();
      C.o.keyStack.push(key);
      let ok = false;
      if (!(C.force.get(key) >= 2)) { try { ok = node.type === 'jsx_expression' ? exprChild(node, depth, key, C) : elementSaid(node, depth, key, C); } catch (e) { ok = false; } }
      C.o.keyStack.pop();
      if (!ok) { C.o.undo(m); C.o.rawLines(depth, C.prefix, C.src, node); }
      return true;
    }
    /* An element on one line of code, said on one line of sentences (nothing under it), or null. */
    function oneLineJsx(node, depth, key, C) {
      if (node.startPosition.row !== node.endPosition.row) return null;
      const m = C.o.mark(), at = C.o.lines.length;
      jsxChild(node, depth, key, C);
      const got = C.o.lines.slice(at);
      C.o.undo(m);
      return got.length === 1 && !got[0].trim().startsWith(C.prefix) && !/^\s*note:/.test(got[0]) ? got[0].trim() : null;
    }
    function elementSaid(node, depth, key, C) {
      if (!JSX_TYPES.includes(node.type)) return false;
      const open = node.type === 'jsx_self_closing_element' ? node : real(node).find(x => x.type === 'jsx_opening_element');
      if (!open) return false;
      const props = real(open).filter(x => x.type === 'jsx_attribute' || x.type === 'jsx_expression');
      const nameN = real(open).find(x => x.type !== 'jsx_attribute' && x.type !== 'jsx_expression' && !isComment(x));
      if (real(open).some(isComment)) return false;
      const tag = nameN ? nameN.text : null;
      if (tag != null && !/^[A-Za-z_$][\w$]*(?:[.-][\w$]+)*$/.test(tag)) return false;
      if (tag == null && props.length) return false;
      let word = tag == null ? 'together' : capital(tag) || tag.includes('.') ? art(tag) : C.WEB.elementWord(tag);
      if (!word) return false;
      // a link's address and a picture's file in its words: a link to "/", a picture of "logo.png", a Link to "/about"
      let first = 0;
      const pn = (p) => (p && p.type === 'jsx_attribute' ? real(p)[0] : null), pv = (p) => (p && p.type === 'jsx_attribute' ? real(p)[1] : null);
      const p0n = pn(props[0]), p0v = pv(props[0]);
      const plainStr = (v) => v && v.type === 'string' && !/\n/.test(v.text);
      // shadcn/ui: a component's variant said before its name (a ghost Button, an outline Badge)
      if (p0n && p0n.text === 'variant' && plainStr(p0v) && /^(["'])[a-z][a-z-]*\1$/.test(p0v.text) && capital(tag || '')) { word = `${art(p0v.text.slice(1, -1))} ${tag}`; first = 1; }
      // react-router: a Route for "/about" showing an About (path, then an element with nothing of its own)
      const el1 = pv(props[1]), shown = el1 && el1.type === 'jsx_expression' && real(el1).length === 1 && real(el1)[0].type === 'jsx_self_closing_element' ? real(el1)[0] : null;
      if (tag === 'Route' && p0n && p0n.text === 'path' && plainStr(p0v) && pn(props[1]) && pn(props[1]).text === 'element' && shown && real(shown).length === 1 && /^[A-Z][\w$]*$/.test(real(shown)[0].text)) {
        word = `a Route for ${p0v.text} showing ${art(real(shown)[0].text)}`; first = 2;
      }
      if (!first && plainStr(p0v) && ((tag === 'a' && p0n.text === 'href') || (tag === 'img' && p0n.text === 'src') || (p0n.text === 'to' && capital(tag)))) { word += `${tag === 'img' ? ' of ' : ' to '}${p0v.text}`; first = 1; }
      const settings = props.slice(first).map(a => propWords(a, C));
      if (settings.some(s => s == null)) return false;
      const items = node.type === 'jsx_element' ? piecesOf(node, C) : [];
      if (!items) return false;
      // one run inside, on the line the element opens and closes on: "saying …" on the same line (one on a line of
      // its own between them is said on a line of its own, under the element)
      const close = node.type === 'jsx_element' ? real(node).find(x => x.type === 'jsx_closing_element') : null;
      const inline = !close || open.endPosition.row === close.startPosition.row;
      const one = inline && items.length === 1 && items[0].run ? runLine(items[0].run) : null;
      if (one && items[0].run.some(p => C.force.get(p.k) >= 2)) return false;
      // the settings one per line (as Prettier writes a long tag), when the code has them so: each a line under it
      if (settings.length && propsOnLines(open, nameN, props)) {
        C.o.say(depth, word + (one ? ' saying ' + one : ''));
        for (const s of settings) C.o.say(depth + 1, s);
      } else C.o.say(depth, word + (one ? ' saying ' + one : '') + settings.map(s => ', ' + s).join(''));
      if (one || !items.length) return true;
      for (const it of items) {
        if (it.node) { jsxChild(it.node, depth + 1, key, C); continue; }
        const k = it.run[0].k;
        C.o.parents.set(k, key);
        const line = runLine(it.run);
        if (line != null && !it.run.some(p => C.force.get(p.k) >= 2)) { C.o.keyStack.push(k); C.o.say(depth + 1, line); C.o.keyStack.pop(); continue; }
        // (as written: the run's own source lines)
        const start = it.run[0].k, end = it.run[it.run.length - 1].end;
        C.o.rawLines(depth + 1, C.prefix, C.src, { startIndex: start, endIndex: Math.max(end, start), nextSibling: null, descendantsOfType: () => [] });
      }
      return true;
    }
    function exprChild(node, depth, key, C) {
      const inner = real(node), all = named(node);
      // {/* a note */}: a note
      if (!inner.length && all.length && all.every(isComment)) { for (const c of all) C.o.notes(depth, c); return true; }
      if (inner.length !== 1) return false;
      const e = inner[0];
      const say = (d, t) => { C.o.say(d, t); return true; };
      if (e.type === 'string' && e.text.slice(1, -1) === ' ') return say(depth, 'a space');
      // only if loading: {loading && <Spinner />}
      if (e.type === 'binary_expression' && F(e, 'operator').type === '&&' && isJsx(F(e, 'right'))) {
        const c = C.ex(F(e, 'left'));
        if (c == null) return false;
        say(depth, `only if ${c}`);
        return jsxChild(unparen(F(e, 'right')), depth + 1, key, C);
      }
      // if … otherwise …: {done ? <A /> : <B />}, either side nothing (null)
      if (e.type === 'ternary_expression') {
        const cons = F(e, 'consequence'), alt = F(e, 'alternative');
        const side = (x) => isJsx(x) || isNull(x);
        if (!side(cons) || !side(alt) || (!isJsx(cons) && !isJsx(alt))) return false;
        const c = C.ex(F(e, 'condition'));
        if (c == null) return false;
        say(depth, `if ${c}`);
        if (isNull(cons)) say(depth + 1, 'nothing'); else jsxChild(unparen(cons), depth + 1, key, C);
        say(depth, 'otherwise');
        if (isNull(alt)) say(depth + 1, 'nothing'); else jsxChild(unparen(alt), depth + 1, key, C);
        return true;
      }
      // for each note in notes: {notes.map((note) => <li key={note.id}>…</li>)}
      if (e.type === 'call_expression' && F(e, 'function').type === 'member_expression' && F(F(e, 'function'), 'property').text === 'map' && !kids(F(e, 'function')).some(k => k.type === 'optional_chain')) {
        const a = C.args(e), f = a[0];
        if (a.length !== 1 || f.type !== 'arrow_function' || has(f, 'async') || !isJsx(F(f, 'body'))) return false;
        const ps = arrowParams(f).map(plainName);
        if (!ps.length || ps.length > 2 || ps.some(p => !p)) return false;
        const list = C.ex(F(F(e, 'function'), 'object'));
        if (list == null || /,\s+counting with\s/.test(list)) return false;
        say(depth, `for each ${ps[0]} in ${list}${ps[1] ? ', counting with ' + ps[1] : ''}`);
        return jsxChild(unparen(F(f, 'body')), depth + 1, key, C);
      }
      return false;
    }

    return { ex, one };
  }

  root.IntuiTsConvert = { ext, sayType, paramWords };
})(typeof window !== 'undefined' ? window : globalThis);

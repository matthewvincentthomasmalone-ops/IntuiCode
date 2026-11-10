/* IntuaCode — existing code -> sentences, for HTML, CSS, JavaScript, C++ and Arduino.
 *
 * The Python version lives in python_reader.py; this is the same idea for the
 * other languages:
 *   1. Walk the code's syntax tree (tree-sitter) and say each statement,
 *      element or style rule as a sentence where one fits.
 *   2. Anything that can't be said exactly stays as code, on a raw line
 *      (html: / css: / js: / c++: / above main: / head:).
 *   3. Check: turn the sentences back into code with the normal translators and
 *      compare syntax trees with the original. Every part that comes back
 *      different is kept as raw code instead, and the check runs again.
 * So the result is either checked exact, or says exactly why it isn't.
 *
 * toSentences(kind, source, env)
 *   kind  'html' | 'css' | 'js' | 'cpp' | 'arduino'
 *   env   { parse(kind, source) -> tree-sitter root node, WEB, CPP,
 *           ids: { id: tag } from the page (for css/js), groups: [class names],
 *           pulled: [hrefs/srcs of the page's own CSS and JS files] (for html) }
 *   -> { ok, text, exact, reason, words, lines, kept }
 */
(function (root) {
  'use strict';

  const IND = '    ';
  const collapse = (s) => String(s).replace(/\s+/g, ' ').trim();
  const toId = (s) => String(s).trim().replace(/^(?:the|my)\s+/i, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const simpleName = (s) => toId(s) === s && /^[a-z]/.test(s);

  const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0', copy: '©', reg: '®', trade: '™', hellip: '…', mdash: '—', ndash: '–', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', times: '×', middot: '·', bull: '•', larr: '←', rarr: '→', uarr: '↑', darr: '↓', deg: '°', euro: '€', pound: '£', laquo: '«', raquo: '»' };
  /* strict (for the check): an & the table doesn't know ("&nearr;", "&copy" without its ;) may still be a
     character to the browser, so it never counts the same as those letters written out. */
  const UPPER_ENT = new Set(['AMP', 'LT', 'GT', 'QUOT', 'COPY', 'REG']);
  const decode = (s, strict) => String(s).replace(strict ? /&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);?/gi : /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    const closed = m.endsWith(';');
    if (e[0] === '#') { const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) && n <= 0x10ffff && (closed || !strict) ? String.fromCodePoint(n) : strict ? '\u0001' + m.slice(1) : m; }
    if (!strict) return ENT[e.toLowerCase()] ?? m;
    return closed && (ENT[e] != null || UPPER_ENT.has(e)) ? ENT[e.toLowerCase()] : '\u0001' + m.slice(1);
  });
  /* A text value as a quoted sentence string for Structure: \" \' and \\ stand for the character itself. */
  const quote = (t) => { const s = String(t).replace(/\\/g, '\\\\'); return !s.includes('"') ? `"${s}"` : !s.includes("'") ? `'${s}'` : `"${s.replace(/"/g, '\\"')}"`; };
  /* Runs of spaces as one space, but not inside quoted text (CSS values, selectors). */
  const collapseCode = (s) => String(s).split(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/).map((p, i) => (i % 2 ? p : p.replace(/\s+/g, ' '))).join('').trim();

  /* The node's source as lines, with the indentation they share removed.
     keep: source ranges whose spaces matter (inside <pre>, <script>…): a line that starts inside one is
     kept whole, and so are the spaces at the end of a line that ends inside one. */
  function srcLines(src, node, keep = []) {
    const lineStart = src.lastIndexOf('\n', node.startIndex - 1) + 1;
    const prefix = src.slice(lineStart, node.startIndex);
    // C++ keeps the ; after a class or struct as a separate token: it belongs with it
    let end = node.endIndex;
    const next = node.nextSibling;
    if (next && next.type === ';' && !src.slice(end, next.startIndex).trim()) end = next.endIndex;
    const lines = src.slice(node.startIndex, end).split('\n');
    const inside = (at) => keep.some(([a, b]) => a <= at && at < b);   // at: the index of a line break
    let at = node.startIndex;
    const breaks = lines.map(l => (at += l.length + 1) - 1);          // the line break after each line
    const kept = lines.map((l, i) => i > 0 && inside(breaks[i - 1]));
    const indentOf = (l) => l.match(/^[ \t]*/)[0].length;
    const first = /^[ \t]*$/.test(prefix) ? prefix.length : null;
    const rest = lines.slice(1).filter((l, i) => l.trim() && !kept[i + 1]).map(indentOf);
    const base = Math.min(...(first != null ? [first] : []), ...rest, 1e9);
    const out = lines.map((l, i) => (kept[i] ? l : i === 0 ? ' '.repeat(Math.max(0, (first ?? base) - base)) + l : l.slice(Math.min(base, indentOf(l)))))
      .map((l, i) => (kept[i] || (i < lines.length - 1 && inside(breaks[i])) ? l : l.replace(/\s+$/, '')));
    while (out.length > 1 && !out[out.length - 1] && !kept[out.length - 1]) out.pop();
    return { lines: out, kept };
  }

  const named = (n) => { const out = []; for (let i = 0; i < n.namedChildCount; i++) out.push(n.namedChild(i)); return out; };
  const kids = (n) => { const out = []; for (let i = 0; i < n.childCount; i++) out.push(n.child(i)); return out; };
  const F = (n, f) => (n ? n.childForFieldName(f) : null);
  const isComment = (n) => n.type === 'comment';

  /* Sentence output with, for each line, the key of the code it came from. */
  function Out() {
    const o = { lines: [], keys: [], raw: 0, words: 0, parents: new Map(), keyStack: [], careful: new Set() };
    o.say = (depth, text) => { o.lines.push(IND.repeat(depth) + text); o.keys.push(o.keyStack[o.keyStack.length - 1] ?? null); if (!/^\s*note:/.test(text)) o.words++; };
    o.raw = 0;
    o.rawLines = (depth, prefix, src, node, text) => {
      const html = prefix === 'html:' || prefix === 'head:';
      // (JavaScript: the lines inside a template literal are its text, so they are kept as they are)
      const keep = html ? keepRanges(node) : prefix === 'js:' ? node.descendantsOfType('template_string').filter(t => t.startPosition.row !== t.endPosition.row).map(t => [t.startIndex, t.endIndex]) : [];
      const { lines } = text != null ? { lines: text.trim().split('\n').map(l => l.trim()) } : srcLines(src, node, keep);
      for (const l of lines) { o.lines.push(IND.repeat(depth) + (l ? `${prefix} ${l}` : prefix)); o.keys.push(node.startIndex); o.raw++; }
    };
    o.blank = () => { if (o.lines.length && o.lines[o.lines.length - 1] !== '') { o.lines.push(''); o.keys.push(null); } };
    o.mark = () => ({ n: o.lines.length, w: o.words, r: o.raw });
    o.undo = (m) => { o.lines.length = m.n; o.keys.length = m.n; o.words = m.w; o.raw = m.r; };
    o.notes = (depth, node) => {
      const text = node.text.replace(/^\/\/+|^\/\*+|\*+\/$|^<!--|-->$/g, '');
      for (let l of text.split('\n')) { l = l.replace(/^\s*\*+(?!\/)/, '').trim(); if (l) { o.lines.push(IND.repeat(depth) + 'note: ' + l); o.keys.push(null); } }
    };
    return o;
  }

  /* Walk a list of statements: blank lines kept, comments as notes, each statement as sentences or raw code. */
  function walkBlock(o, nodes, depth, parentKey, force, prefix, src, one) {
    let prevEnd = null;
    for (const n of nodes) {
      if (prevEnd != null && n.startPosition.row > prevEnd + 1) o.blank();
      prevEnd = n.endPosition.row;
      o.parents.set(n.startIndex, parentKey);
      if (isComment(n)) { o.notes(depth, n); continue; }
      if (n.type === 'empty_statement' || n.type === ';') continue;
      const m = o.mark();
      o.keyStack.push(n.startIndex);
      let done = false;
      const lvl = force.get(n.startIndex) || 0;
      if (lvl < 2 && !force.has('ALL')) { try { done = one(n, depth, lvl); } catch (e) { done = false; } }
      o.keyStack.pop();
      if (!done) { o.undo(m); o.rawLines(depth, prefix, src, n); }
    }
  }

  /* ================================================================== */
  /* Comparing syntax trees                                              */
  /* ================================================================== */

  /* Normalised tree: { t, v (leaves), c (children), k (source position), block }
     Leaves keep their exact text: spaces inside strings, regexes and templates matter. */
  function normalise(node, rules) {
    const r = rules.rewrite ? rules.rewrite(node) : null;
    if (r === 'skip') return null;
    if (r && r.node) return normalise(r.node, rules);
    if (r && r.t) return r;
    const o = { t: node.type, k: node.startIndex };
    if (!node.childCount) { o.v = rules.leaf ? rules.leaf(node) : node.text; return o; }
    // text the grammar keeps between its child nodes (the digits of -2px, the letters of a CSS string) counts too
    let gaps = '', pos = node.startIndex;
    for (const c of kids(node)) { gaps += node.text.slice(pos - node.startIndex, c.startIndex - node.startIndex) + '\u0000'; pos = c.endIndex; }
    gaps += node.text.slice(pos - node.startIndex);
    if (/[^\s\u0000]/.test(gaps) || (rules.exactGaps && rules.exactGaps(node))) o.v = gaps;
    o.c = [];
    for (const c of kids(node)) {
      if (isComment(c) || (rules.skip && rules.skip(c))) continue;
      const x = normalise(c, rules);
      if (x) o.c.push(x);
    }
    if (rules.block && rules.block(node)) o.block = true;
    if (rules.after) rules.after(o, node);
    return o;
  }
  function hashOf(o) {
    if (o.h) return o.h;
    o.h = o.c ? `${o.t}${o.v != null ? ':' + JSON.stringify(o.v) : ''}(${o.c.map(hashOf).join(',')})` : `${o.t}:${JSON.stringify(o.v)}`;
    return o.h;
  }
  let blameNear = false;   // set while comparing HTML (see cmpBlock)
  /* true = same; false = differs (blame the enclosing statement); [keys] = these statements differ. */
  function cmp(a, b) {
    if (a.t !== b.t || a.v !== b.v || !!a.c !== !!b.c) return false;
    if (!a.c) return true;
    if (a.block) return cmpBlock(a.c, b.c);
    if (a.c.length !== b.c.length) return false;
    const out = [];
    for (let i = 0; i < a.c.length; i++) { const r = cmp(a.c[i], b.c[i]); if (r === false) return false; if (r !== true) out.push(...r); }
    return out.length ? out : true;
  }
  function cmpPairs(as, bs, out) {
    for (let i = 0; i < as.length; i++) { const r = cmp(as[i], bs[i]); if (r === false) out.push(as[i].k); else if (r !== true) out.push(...r); }
  }
  function cmpBlock(as, bs) {
    const out = [];
    if (as.length === bs.length) { cmpPairs(as, bs, out); return out.length ? out : true; }
    // line the two lists up (longest common run of identical items), then look at the gaps
    const n = as.length, m = bs.length;
    const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = hashOf(as[i]) === hashOf(bs[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    let i = 0, j = 0, gi = 0, gj = 0;
    const gap = (i2, j2) => {
      const ga = as.slice(gi, i2), gb = bs.slice(gj, j2);
      if (ga.length === gb.length) cmpPairs(ga, gb, out);
      else if (ga.length) out.push(...ga.map(x => x.k));
      else if (blameNear && [as[gi - 1], as[gi]].some(x => x && x.k != null)) out.push(...[as[gi - 1], as[gi]].filter(x => x && x.k != null).map(x => x.k));   // (HTML: a space too many between two things: blame them)
      else out.push(null);   // extra code with nothing to blame
    };
    while (i < n && j < m) {
      if (hashOf(as[i]) === hashOf(bs[j])) { if (i > gi || j > gj) gap(i, j); i++; j++; gi = i; gj = j; }
      else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
      else j++;
    }
    if (gi < n || gj < m) gap(n, m);
    if (out.includes(null)) return false;
    return out.length ? out : true;
  }

  /* Bodies written without braces count the same as a block of one statement. */
  function wrapBodies(o, node, fields, blockType) {
    for (const f of fields) {
      const c = F(node, f);
      if (!c || c.type === blockType || c.type === 'if_statement') continue;
      const idx = o.c.findIndex(x => x.k === c.startIndex && x.t === c.type);
      if (idx >= 0) o.c[idx] = { t: blockType, k: c.startIndex, block: true, c: [o.c[idx]] };
    }
  }

  /* ================================================================== */
  /* JavaScript                                                          */
  /* ================================================================== */

  const JS_OPS = { '===': 'is', '!==': 'is not', '&&': 'and', '||': 'or', '+': 'plus', '-': 'minus', '*': 'times', '/': 'divided by', '%': 'mod', '>': 'is greater than', '<': 'is less than', '>=': 'is at least', '<=': 'is at most' };
  const EVENTS = { click: 'clicked', dblclick: 'double-clicked', change: 'changed', input: 'typed in', mouseenter: 'hovered', submit: 'sent', focus: 'focused', blur: 'unfocused', scroll: 'scrolled', resize: 'resized' };
  // tags the writer's "make a new … and store in …" makes, by its word for each
  const MADE_WORD = { li: 'list item', div: 'block', p: 'paragraph', span: 'text', a: 'link', img: 'picture', button: 'button', h1: 'big heading', h2: 'heading', h3: 'small heading', section: 'section', ul: 'list', ol: 'numbered list', label: 'label', option: 'option', tr: 'row', td: 'cell', canvas: 'drawing area' };
  const isChain = (n) => n && (n.type === 'identifier' || n.type === 'this' || (n.type === 'member_expression' && F(n, 'property').type === 'property_identifier' && isChain(F(n, 'object'))));

  function jsConvert(src, env, force) {
    const tree = env.parse('js', src);
    const o = Out();
    const ids = env.ids || {};
    const fileFns = new Set(tree.descendantsOfType('function_declaration').map(f => (F(f, 'name') || {}).text).filter(Boolean));   // this file's own tools
    const asyncFns = new Set(tree.descendantsOfType('function_declaration').filter(f => kids(f).some(k => k.type === 'async')).map(f => (F(f, 'name') || {}).text));   // the ones that wait
    const elId = (n) => {   // document.getElementById("x") -> x (a name from the page)
      if (!n || n.type !== 'call_expression' || F(n, 'function').text !== 'document.getElementById') return null;
      const a = named(F(n, 'arguments')).filter(x => !isComment(x));
      if (a.length !== 1 || a[0].type !== 'string') return null;
      const id = a[0].text.slice(1, -1);
      return ids[id] && simpleName(id) ? id : null;
    };
    const isField = (id) => /^(input|textarea|select)$/.test(ids[id]);
    const plainString = (n) => n && n.type === 'string' && !/\\/.test(n.text);
    /* An element said in words: a page element by its name, "the element called "x"" (an id Structure doesn't
       name), "the element matching ".x"", "the page" (document), or a name in Mechanics that may hold one
       (const form = …; the writer checks it does). */
    const holder = (n) => {
      if (!n) return null;
      if (elId(n)) return elId(n);
      if (n.type === 'identifier') return n.text === 'document' && !ids.page ? 'the page' : n.text === 'window' && !ids.window ? 'the window' : !ids[n.text] && !/^(?:document|window|event|this)$/.test(n.text) ? n.text : null;
      if (n.type !== 'call_expression') return null;
      const a = args(n), f = F(n, 'function').text;
      if (a.length !== 1 || !plainString(a[0])) return null;
      if (f === 'document.getElementById') return `the element called ${a[0].text}`;
      if (f === 'document.querySelector') return `the element matching ${a[0].text}`;
      return null;
    };
    /* Phrases inside a bigger value. A whole-value phrase ("the result of f with x", "a if c otherwise b", "a
       list of …") and a phrase with words round a value ("x read as JSON") go in brackets there, as the writer
       reads them. */
    const whole = new Set(), phrase = new Set();
    const W = (s) => { if (s != null) whole.add(s); return s; };
    const P = (s) => { if (s != null) phrase.add(s); return s; };
    const topOf = (s) => {   // s with quoted text and the insides of brackets hidden
      const q = s.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/g, (m) => '\u0001'.repeat(m.length));
      let out = '', d = 0;
      for (let i = 0; i < q.length; i++) { const c = q[i]; if ('([{'.includes(c)) { out += d ? '\u0001' : c; d++; } else if (')]}'.includes(c)) { d = Math.max(0, d - 1); out += d ? '\u0001' : c; } else out += d ? '\u0001' : c; }
      return out;
    };
    const simple = (s) => s != null && !/\s/.test(topOf(s)) && !/^[([{!]|^-(?!\d)/.test(s);   // one operand: a name, number, quoted text, a.b(…)[…]
    const grouped = (s) => /^\(\u0001*\)$/.test(topOf(s));                                           // in brackets already
    const tight = (s) => (s != null && (whole.has(s) || phrase.has(s)) ? `(${s})` : s);           // as a part of a sum or a test
    const opx = (s) => (s == null ? null : simple(s) || grouped(s) ? s : `(${s})`);                  // before or after the newer phrases
    const opd = (s) => (s == null ? null : simple(s) ? s : whole.has(s) ? `(${s})` : grouped(s) && whole.has(s.slice(1, -1)) ? s : null);   // … and the older ones ("length of x")
    const item = (s) => (s != null && /,|\sand\s/.test(topOf(s)) ? `(${s})` : s);   // one of several, split at commas and "and"
    const inList = (s) => (s != null && whole.has(s) ? `(${s})` : s);                                    // inside [ … ] or { … }
    // a little function given to .map, .filter and the like: x => …, (x) => …, of one value
    const little = (fnNode) => {
      if (!fnNode || fnNode.type !== 'arrow_function' || kids(fnNode).some(k => k.type === 'async')) return null;
      const ps = F(fnNode, 'parameters'), p1 = F(fnNode, 'parameter');
      const p = p1 && p1.type === 'identifier' ? p1 : ps && named(ps).length === 1 && named(ps)[0].type === 'identifier' ? named(ps)[0] : null;
      const body = F(fnNode, 'body');
      if (!p || !body || body.type === 'statement_block') return null;
      return { p: p.text, body };
    };
    const rest = (a) => a.map(ex).map(item);
    // a list or record written over several lines stays as code when it would make one long sentence (a table of data)
    const long = (n, parts) => n.startPosition.row !== n.endPosition.row && parts.join(', ').length > 100;
    const val = (n) => (n && n.type === 'array' && !named(n).length ? 'an empty list' : ex(n));   // a whole value: [] in words
    function ex(n) {
      if (!n) return null;
      switch (n.type) {
        case 'identifier': case 'number': case 'true': case 'false': case 'undefined': case 'this': return n.text;
        case 'null': return 'nothing';
        case 'string': return n.text[0] === '"' && /\{\{|\}\}|\{[^{}]+\}/.test(n.text) ? null : n.text;   // in "…" the Mechanics translator fills in {x}
        case 'regex': return /[,"'`]|\sand\s/.test(n.text) ? null : n.text;   // sentences would split it there
        case 'template_string': {
          let s = '';
          for (const c of kids(n)) {
            if (c.type === '`') continue;
            if (c.type === 'template_substitution') { const e = ex(named(c)[0]); if (e == null || /[{}"]/.test(e)) return null; s += `{${e}}`; }
            else if (/[{}"\\]/.test(c.text)) return null;
            else s += c.text;
          }
          return /\n/.test(s) ? null : `"${s}"`;
        }
        case 'parenthesized_expression': { const e = ex(named(n)[0]); return e == null ? null : `(${e})`; }
        case 'binary_expression': {
          // a whole-value phrase goes in brackets; "x read as JSON" too after plus, minus… (the writer would ask which part it goes with)
          const op = F(n, 'operator').type, arith = /^(?:[-+*/%]|\*\*)$/.test(op);
          const l = inList(ex(F(n, 'left'))), r0 = /^(?:\|\||\?\?)$/.test(op) ? val(F(n, 'right')) : ex(F(n, 'right')), r = arith ? tight(r0) : inList(r0);
          if (l == null || r == null) return null;
          if (op === '??') return W(`${l}, or ${r} if that is nothing`);
          // x == null: nothing or undefined (the writer's "is nothing"); x === null: null itself
          if ((op === '==' || op === '!=') && F(n, 'right').type === 'null') return `${l} ${op === '==' ? 'is' : 'is not'} nothing`;
          if (F(n, 'right').type === 'null') return JS_OPS[op] ? `${l} ${JS_OPS[op]} null` : `${l} ${op} null`;
          if (op === '===' && F(n, 'right').text === '0' && F(n, 'left').type === 'member_expression' && F(F(n, 'left'), 'property').text === 'length' && isChain(F(F(n, 'left'), 'object'))) return `${F(F(n, 'left'), 'object').text} is empty`;
          return `${l} ${JS_OPS[op] || op} ${r}`;
        }
        case 'unary_expression': {
          const op = F(n, 'operator').type, a = tight(ex(F(n, 'argument')));
          if (a == null) return null;
          return op === '!' ? `not ${a}` : /^[a-z]/.test(op) ? `${op} ${a}` : `${op}${a}`;
        }
        case 'ternary_expression': {
          const c = inList(ex(F(n, 'condition'))), a = inList(val(F(n, 'consequence'))), b = val(F(n, 'alternative'));
          return c == null || a == null || b == null ? null : W(`${a} if ${c} otherwise ${b}`);
        }
        case 'member_expression': {
          const obj = F(n, 'object'), prop = F(n, 'property').text;
          const id = elId(obj);
          if (id && /^(value|textContent)$/.test(prop) && (prop === 'value') === isField(id)) return `text of ${id}`;
          if (obj.type === 'identifier' && obj.text === 'document' && prop === 'title') return 'the page title';
          if (prop === 'length' && !kids(n).some(k => k.type === 'optional_chain')) { const o2 = isChain(obj) ? obj.text : opd(ex(obj)); if (o2 != null) return `length of ${o2}`; }
          return n.text.includes('\n') ? null : n.text;
        }
        case 'subscript_expression': {
          if (kids(n).some(k => k.type === 'optional_chain')) return n.text.includes('\n') ? null : n.text;
          const obj = F(n, 'object'), at = F(n, 'index');
          const o2 = ex(obj), list = o2 != null && /^(?:first |last )?item /.test(o2) ? o2 : opd(o2);
          if (list == null || !at) return null;
          if (at.type === 'number' && at.text === '0') return `first item of ${list}`;
          if (isChain(obj) && at.text.replace(/\s+/g, '') === `Math.floor(Math.random()*${obj.text}.length)`) return `random item from ${list}`;
          if (isChain(obj) && at.type === 'binary_expression' && F(at, 'operator').type === '-' && F(at, 'right').text === '1' && F(at, 'left').text === `${obj.text}.length`) return `last item of ${list}`;
          const i = ex(at);
          return i == null ? null : `item ${simple(i) ? i : `(${i})`} of ${list}`;
        }
        case 'call_expression': {
          const fn = F(n, 'function'), a = args(n);
          if (!F(n, 'arguments') || F(n, 'arguments').type !== 'arguments' || kids(n).some(k => k.type === 'optional_chain')) return n.text.includes('\n') ? null : n.text;
          if (elId(n)) return elId(n);
          const f = fn.text;
          // the page: elements by id, by a CSS selector, and new ones
          if (/^document\.(?:getElementById|querySelector(?:All)?|createElement)$/.test(f) && a.length === 1 && plainString(a[0])) {
            if (f === 'document.getElementById') return P(`the element called ${a[0].text}`);
            if (f === 'document.createElement') return P(`a new ${a[0].text} element`);
            return `${/All$/.test(f) ? 'every' : 'the'} element matching ${a[0].text}`;
          }
          const one = a.length === 1 ? ex(a[0]) : null;
          if (f === 'localStorage.getItem' && one != null) return P(`the text saved in the browser as ${opx(one)}`);
          if (f === 'JSON.parse' && one != null) return P(`${opx(one)} read as JSON`);
          if (f === 'JSON.stringify' && one != null) return P(`${opx(one)} as JSON text`);
          // random numbers: Math.random() is from 0 up to 1; Math.floor(Math.random() * n) a whole number from 0 up to n - 1
          if (f === 'Math.random' && !a.length) return P('a random number below 1');
          if (f === 'Math.floor' && a.length === 1 && a[0].type === 'binary_expression' && F(a[0], 'operator').type === '*' && F(a[0], 'left').type === 'call_expression' && F(a[0], 'left').text.replace(/\s+/g, '') === 'Math.random()') {
            const k = ex(F(a[0], 'right'));
            if (k != null) return P(`a random whole number below ${opx(k)}`);
          }
          if (/^Math\.(?:round|floor|ceil)$/.test(f) && one != null) return P(`${opx(one)} rounded${{ 'Math.floor': ' down', 'Math.ceil': ' up' }[f] || ''}`);
          if (/^Math\.(?:max|min)$/.test(f) && a.length === 1 && a[0].type === 'spread_element') { const l = ex(named(a[0])[0]); if (l != null) return P(`the ${f === 'Math.max' ? 'largest' : 'smallest'} number in ${opx(l)}`); }
          if (f === 'Number' && a.length === 1 && isChain(a[0])) return `${one} as number`;
          if (f === 'String' && a.length === 1 && isChain(a[0])) return `${one} as text`;
          if (fn.type === 'member_expression' && F(fn, 'property').type === 'property_identifier' && !kids(fn).some(k => k.type === 'optional_chain')) {
            const obj = F(fn, 'object'), m = F(fn, 'property').text, on = ex(obj);
            // text and lists
            if (on != null) {
              if (m === 'join' && a.length === 1 && one != null) return P(`${opx(on)} joined by ${opx(one)}`);
              if (m === 'toFixed' && a.length === 1 && one != null) return P(`${opx(on)} to ${opx(one)} decimal places`);
              if (m === 'split' && a.length === 1 && one != null) return P(`${opx(on)} split at ${opx(one)}`);
              if (m === 'trim' && !a.length) return P(`${opx(on)} trimmed`);
              if (/^to(?:Upper|Lower)Case$/.test(m) && !a.length) return P(`${opx(on)} in ${m === 'toUpperCase' ? 'capitals' : 'lowercase'}`);
              if (m === 'includes' && a.length === 1 && opd(on) != null && opd(one) != null) return `${opd(on)} contains ${opd(one)}`;
              if (m === 'test' && obj.type === 'regex' && a.length === 1 && opd(one) != null) return `${opd(one)} matches ${on}`;
              if (m === 'contains' && F(obj, 'property') && F(obj, 'property').text === 'classList' && a.length === 1 && plainString(a[0]) && simpleName(a[0].text.slice(1, -1)) && opd(ex(F(obj, 'object'))) != null && simple(ex(F(obj, 'object')))) return `${ex(F(obj, 'object'))} is in group ${a[0].text.slice(1, -1)}`;
              // a list made from another, item by item: .map, .filter (and both), .find, .every, .some
              const lf = a.length === 1 ? little(a[0]) : null;
              if (lf && /^(?:map|filter|find|every|some)$/.test(m)) {
                const e = ex(lf.body);
                if (e == null) return null;
                if (m === 'map') {
                  // xs.filter(x => c).map(x => e): one list, "… for each x in xs if c"
                  const inner = obj.type === 'call_expression' && F(obj, 'function').type === 'member_expression' && F(F(obj, 'function'), 'property').text === 'filter' && args(obj).length === 1 ? little(args(obj)[0]) : null;
                  if (inner && inner.p === lf.p) { const L2 = ex(F(F(obj, 'function'), 'object')), c = ex(inner.body); if (L2 != null && c != null) return W(`a list of ${inList(e)} for each ${lf.p} in ${inList(L2)} if ${c}`); }
                  return W(`a list of ${inList(e)} for each ${lf.p} in ${inList(on)}`);
                }
                if (m === 'filter') return W(`a list of ${lf.p} for each ${lf.p} in ${inList(on)} if ${e}`);
                if (m === 'find') return W(`the first ${lf.p} in ${inList(on)} where ${e}`);
                return W(`${inList(e)} for ${m === 'every' ? 'every' : 'any'} ${lf.p} in ${on}`);
              }
            }
          }
          if (!isChain(fn)) return n.text.includes('\n') ? null : n.text;
          const v = rest(a);
          if (v.some(x => x == null)) return null;
          return W(`the result of ${f}${v.length ? ' with ' + v.join(', ') : ''}`);
        }
        case 'new_expression': {
          const c = F(n, 'constructor'), al = F(n, 'arguments');
          if (!isChain(c) || !al) return n.text.includes('\n') ? null : n.text;
          const v = rest(args(n));
          return v.some(x => x == null) ? null : W(`a new ${c.text}${v.length ? ' with ' + v.join(', ') : ''}`);
        }
        case 'array': { const items = named(n).filter(x => !isComment(x)).map(ex).map(inList); return items.some(a => a == null) || long(n, items) ? null : `[${items.join(', ')}]`; }
        case 'object': {
          const parts = [];
          for (const p of named(n).filter(x => !isComment(x))) {
            if (p.type === 'shorthand_property_identifier') { parts.push(p.text); continue; }
            if (p.type !== 'pair' || !/^(?:property_identifier|string|number)$/.test(F(p, 'key').type)) return n.text.includes('\n') ? null : n.text;
            const v = inList(ex(F(p, 'value')));
            if (v == null) return null;
            parts.push(`${F(p, 'key').text}: ${v}`);
          }
          return long(n, parts) ? null : parts.length ? `{ ${parts.join(', ')} }` : '{}';
        }
        case 'await_expression': {
          const c = named(n)[0];
          if (c && c.type === 'call_expression' && !kids(c).some(k => k.type === 'optional_chain')) {
            const f = F(c, 'function'), a = args(c);
            if (f.text === 'fetch' && a.length === 1 && ex(a[0]) != null) return P(`the reply from ${opx(ex(a[0]))}`);
            if (f.type === 'member_expression' && /^(?:json|text)$/.test(F(f, 'property').text) && !a.length && ex(F(f, 'object')) != null) return P(`the ${F(f, 'property').text === 'json' ? 'JSON' : 'text'} read from ${opx(ex(F(f, 'object')))}`);
          }
          const v = ex(c);
          return v == null ? null : W(`wait for ${v}`);
        }
        default: return n.text.includes('\n') ? null : n.text;
      }
    }
    const args = (call) => named(F(call, 'arguments')).filter(x => !isComment(x));
    const bodyOf = (n) => (n.type === 'statement_block' ? named(n) : [n]);
    const block = (nodes, depth, key) => walkBlock(o, nodes, depth, key, force, 'js:', src, one);
    let breakIn = null;   // what a break here ends: 'loop' or 'case' (of "depending on")
    const inside = (kind, fn) => { const was = breakIn; breakIn = kind; try { fn(); } finally { breakIn = was; } };
    const JUMP = /^(?:return_statement|break_statement|continue_statement|throw_statement)$/;
    // a tool's inputs: names, or a name with the value it has when it's left out (quantity = 1), as the writer copies them
    const paramList = (fn) => {
      const ps = named(F(fn, 'parameters')).filter(x => !isComment(x));
      const ok = (p) => p.type === 'identifier' || (p.type === 'assignment_pattern' && F(p, 'left').type === 'identifier' && !/\n/.test(F(p, 'right').text));
      return ps.every(ok) ? ps.map(p => (p.type === 'identifier' ? p.text : `${F(p, 'left').text} = ${F(p, 'right').text}`)) : null;
    };

    /* () => { … }, (event) => { … }, or one expression, () => f(x), which counts as { f(x); } where nothing reads
       what it gives back (a listener or a timer). name: the event's name when it isn't "event". */
    function handler(fnNode, allowEvent, most = 1) {
      if (!fnNode || fnNode.type !== 'arrow_function') return null;
      const params = F(fnNode, 'parameters') || F(fnNode, 'parameter');
      const p = params ? (params.type === 'identifier' ? [params] : named(params)) : [];
      if (p.length > most || (p.length && (!allowEvent || p.some(q => q.type !== 'identifier')))) return null;
      const body = F(fnNode, 'body');
      if (!body) return null;
      const name = p.length ? p[0].text : null;
      if (body.type === 'statement_block') return { body: named(body), usesEvent: p.length === 1, name };
      if (body.type === 'update_expression' || /^(?:object|sequence_expression|parenthesized_expression)$/.test(body.type)) return null;
      const stmt = { type: 'expression_statement', startIndex: body.startIndex, endIndex: body.endIndex, startPosition: body.startPosition, endPosition: body.endPosition,
        text: body.text, namedChildCount: 1, childCount: 1, namedChild: () => body, child: () => body, nextSibling: null, parent: fnNode, descendantsOfType: (t) => body.descendantsOfType(t) };
      return { body: [stmt], usesEvent: p.length === 1, name };
    }

    /* setInterval(() => { … }, 2000) or setTimeout: { every, secs, h (its lines) }, or null */
    const timerOf = (c) => {
      if (!c || c.type !== 'call_expression' || !/^(?:setInterval|setTimeout)$/.test(F(c, 'function').text) || args(c).length !== 2 || args(c)[1].type !== 'number') return null;
      const h = handler(args(c)[0], false);
      return h && { every: F(c, 'function').text === 'setInterval', secs: +args(c)[1].text / 1000, h };
    };
    /* await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(v) }):
       the writer's "send v to url". Gives back { v, u } in words, or null. */
    function sendOf(c) {
      if (!c || c.type !== 'call_expression' || F(c, 'function').text !== 'fetch' || args(c).length !== 2 || args(c)[1].type !== 'object') return null;
      const body = named(args(c)[1]).find(p => p.type === 'pair' && F(p, 'key').text === 'body'), val = body && F(body, 'value');
      if (!val || val.type !== 'call_expression' || F(val, 'function').text !== 'JSON.stringify' || args(val).length !== 1) return null;
      const want = `{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(${val.text.replace(/\s+/g, '').slice(15, -1)})}`;
      if (args(c)[1].text.replace(/\s+/g, '').replace(/,\}/g, '}') !== want) return null;
      const u = ex(args(c)[0]), v = ex(args(val)[0]);
      return u == null || v == null || /\sand store the reply in\s/.test(u) ? null : { u, v: /\sto\s/.test(topOf(v)) || whole.has(v) ? `(${v})` : v };
    }
    function exprStmt(e, depth, lvl = 0) {
      const say = (t) => { o.say(depth, t); return true; };
      if (e.type === 'await_expression') {
        const c = named(e)[0];
        const sent = sendOf(c);
        if (sent) return say(`send ${sent.v} to ${sent.u}`);
        if (!c || c.type !== 'call_expression' || !isChain(F(c, 'function'))) { const v = c && c.type !== 'call_expression' ? ex(c) : null; return v != null && say(`wait for ${v}`); }
        const a = rest(args(c)), f = F(c, 'function').text;
        if (a.some(x => x == null)) return false;
        // a tool of this file is waited for by "run"; anything else (fetch, a browser call), or the careful way, by "wait for"
        if (fileFns.has(f) && !lvl) return say(`run ${f}${a.length ? ' with ' + a.join(', ') : ''}`);
        if (f === 'fetch' && a.length === 1) return say(`wait for ${ex(e)}`);   // "wait for the reply from "/api""
        return say(a.length ? `wait for ${f} with ${a.join(', ')}` : `wait for the result of ${f}`);
      }
      // a tool of this file that waits, run without waiting for it (no await): said so, or the writer would wait
      if (lvl || (e.type === 'call_expression' && F(e, 'function').type === 'identifier' && asyncFns.has(F(e, 'function').text))) {
        if (e.type !== 'call_expression' || F(e, 'function').type !== 'identifier' || !fileFns.has(F(e, 'function').text)) return false;
        const v = rest(args(e));
        return !v.some(x => x == null) && say(`run ${F(e, 'function').text}${v.length ? ' with ' + v.join(', ') : ''} without waiting`);
      }
      if (e.type === 'call_expression') {
        const fn = F(e, 'function'), a = args(e);
        const fnText = fn.text;
        if (fnText === 'console.log' && a.length) { const v = rest(a); return v.some(x => x == null) ? false : say(`show ${v.join(', ')}`); }
        if (fnText === 'alert' && a.length === 1) { const v = ex(a[0]); return v != null && say(`show a message ${v}`); }
        if ((fnText === 'setInterval' || fnText === 'setTimeout') && a.length === 2 && a[1].type === 'number') {
          const h = handler(a[0], false);
          if (!h) return false;
          say(`${fnText === 'setInterval' ? 'every' : 'after'} ${+a[1].text / 1000} seconds`);
          block(h.body, depth + 1, e.startIndex);
          return true;
        }
        if (/^clear(?:Interval|Timeout)$/.test(fnText) && a.length === 1 && a[0].type === 'identifier') return say(`stop ${a[0].text}`);
        if (fn.type === 'member_expression') {
          const obj = F(fn, 'object'), prop = F(fn, 'property').text;
          if (prop === 'addEventListener' && a.length === 2 && a[0].type === 'string') {
            const ev = a[0].text.slice(1, -1);
            if ((obj.text === 'document' && ev === 'DOMContentLoaded') || (obj.text === 'window' && ev === 'load')) { const h = handler(a[1], false); if (!h) return false; say(ev === 'load' ? 'when the window has loaded' : 'when the page has loaded'); block(h.body, depth + 1, e.startIndex); return true; }
            const id = holder(obj), key = /^key(?:down|up)$/.test(ev);
            if (!id || (!EVENTS[ev] && !key) || (key && /^the (?:page|window)$/.test(id))) return false;
            const h = handler(a[1], true);
            if (!h) return false;
            let body = h.body;
            const evName = h.name || 'event';
            if (ev === 'submit') {
              if (!h.usesEvent || !body.length || body[0].text.replace(/\s+/g, '') !== `${evName}.preventDefault();`) return false;
              body = body.slice(1);
            }
            // the writer calls the event "event", and only names it when the lines use it; say so otherwise
            const usesName = h.name && body.some(s => new RegExp(`\\b${h.name.replace(/\$/g, '\\$')}\\b`).test(s.text.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, '""')));
            const named_ = h.name && (h.name !== 'event' || (ev !== 'submit' && !usesName)) ? `, with the event as ${h.name}` : '';
            say(key ? `when a key is ${ev === 'keydown' ? 'pressed' : 'released'} in ${id}${named_}` : `when ${id} is ${EVENTS[ev]}${named_}`);
            block(body, depth + 1, e.startIndex);
            return true;
          }
          if (F(obj, 'property') && F(obj, 'property').text === 'classList' && a.length === 1 && a[0].type === 'string') {
            const id = holder(F(obj, 'object')), g = a[0].text.slice(1, -1);
            if (!id || !simpleName(g)) return false;
            if (prop === 'add') return say(`put ${id} in group ${g}`);
            if (prop === 'remove') return say(`take ${id} out of group ${g}`);
            if (prop === 'toggle') return say(`switch group ${g} on ${id}`);
            return false;
          }
          const id = elId(obj);
          if (id && prop === 'scrollIntoView' && e.text.replace(/\s+/g, '').endsWith('.scrollIntoView({behavior:"smooth"})')) return say(`scroll to ${id}`);
          if (id && prop === 'replaceChildren' && !a.length && !isField(id)) return say(`clear ${id}`);
          if (fnText === 'localStorage.setItem' && a.length === 2 && a[1].type === 'call_expression' && F(a[1], 'function').text === 'JSON.stringify' && args(a[1]).length === 1) {
            const k = ex(a[0]), v = ex(args(a[1])[0]);
            return k != null && v != null && say(`save ${v} in the browser as ${k}`);
          }
          if (prop === 'push' && a.length === 1 && obj.type === 'identifier' && !ids[obj.text]) { const v = item(ex(a[0])); return v != null && say(`add ${v} to ${obj.text}`); }
          if (prop === 'appendChild' && a.length === 1) { const h = holder(obj), w = holder(a[0]); return !!h && !!w && !/^the (?:page|window)$/.test(h) && !/^the (?:page|window)$/.test(w) && say(`put ${w} at the end of ${h}`); }
          if (prop === 'remove' && !a.length && holder(obj) && !/^the (?:page|window)$/.test(holder(obj))) return say(`remove ${holder(obj)} from the page`);
          // sorting a list in place, and turning it round
          if (prop === 'sort' && (!a.length || (a.length === 1 && /^\(a,b\)=>(?:a-b|b-a)$/.test(a[0].text.replace(/\s+/g, ''))))) { const l = ex(obj); return l != null && say(`sort ${l} ${!a.length ? 'as text' : /a-b$/.test(a[0].text.replace(/\s+/g, '')) ? 'from smallest to biggest' : 'from biggest to smallest'}`); }
          if (prop === 'reverse' && !a.length) { const l = ex(obj); return l != null && say(`reverse ${l}`); }
          // .forEach(x => { … }): "do this for each x in xs", a little tool run for each item
          if (prop === 'forEach' && a.length === 1 && a[0].type === 'arrow_function') {
            const ps = F(a[0], 'parameters') ? named(F(a[0], 'parameters')) : [F(a[0], 'parameter')];
            const l = ex(obj), h = handler(a[0], true, 2);
            if (l == null || !h || !ps.length || ps.length > 2 || ps.some(p => !p || p.type !== 'identifier') || /\scounting with\s/.test(l)) return false;
            say(`do this for each ${ps[0].text} in ${l}${ps[1] ? ', counting with ' + ps[1].text : ''}`);
            inside(null, () => block(h.body, depth + 1, e.startIndex));
            return true;
          }
        }
        if (isChain(fn)) { const v = rest(a); if (v.some(x => x == null)) return false; return say(`run ${fnText}${v.length ? ' with ' + v.join(', ') : ''}`); }
        return false;
      }
      if (e.type === 'assignment_expression') {
        const left = F(e, 'left'), right = F(e, 'right');
        if (left.type === 'subscript_expression') { const t = ex(left), v = ex(right); return !!t && /^(?:first |last )?item /.test(t) && v != null && say(`set ${t} to ${v}`); }
        if (left.type === 'member_expression') {
          const obj = F(left, 'object'), id = elId(obj), prop = F(left, 'property').text;
          if (id && (prop === 'textContent' || prop === 'value') && (prop === 'value') === isField(id)) {
            if (prop === 'value' && right.text === '""') return say(`clear ${id}`);
            const v = ex(right); return v != null && say(`set the text of ${id} to ${v}`);
          }
          if (obj.type === 'identifier' && obj.text === 'document' && prop === 'title') { const v = ex(right); return v != null && say(`set the page title to ${v}`); }
          // an element found as the code runs, or held in a name: its text, value, HTML, groups, tick
          const h = holder(obj);
          if (h && h !== 'the page' && /^(?:textContent|value|innerHTML|className|checked)$/.test(prop) && !(id && /^(?:textContent|value)$/.test(prop))) {
            if (prop === 'checked') return /^(?:true|false)$/.test(right.text) && say(`${right.text === 'true' ? 'tick' : 'untick'} ${h}`);
            const v = ex(right);
            return v != null && say(`set the ${{ textContent: 'text', value: 'value', innerHTML: 'HTML', className: 'groups' }[prop]} of ${h} to ${v}`);
          }
          if (prop === 'hidden' && /^(true|false)$/.test(right.text) && holder(F(left, 'object'))) return say(`${right.text === 'true' ? 'hide' : 'reveal'} ${holder(F(left, 'object'))}`);
          if (left.text === 'window.location.href') { const v = ex(right); return v != null && say(`go to ${v}`); }
          if (isChain(left) && !id) { const v = val(right); return v != null && say(`set ${left.text} to ${v}`); }
          // a value inside one item: "set done of item index of todos to …" (todos[index].done)
          if (obj.type === 'subscript_expression' && F(left, 'property').type === 'property_identifier' && !kids(left).some(k => k.type === 'optional_chain')) {
            const t = ex(obj), v = val(right);
            return !!t && /^(?:first |last )?item /.test(t) && v != null && !/^(?:text|value)$/.test(prop) && say(`set ${prop} of ${t} to ${v}`);
          }
          return false;
        }
        if (left.type !== 'identifier') return false;
        const tm = timerOf(right);
        if (tm) { say(`${tm.every ? 'every' : 'after'} ${tm.secs} seconds as ${left.text}`); block(tm.h.body, depth + 1, e.startIndex); return true; }
        const v = val(right);
        return v != null && say(`set ${left.text} to ${v}`);
      }
      if (e.type === 'augmented_assignment_expression') {
        const op = F(e, 'operator').type, left = F(e, 'left');
        if ((op !== '+=' && op !== '-=') || !isChain(left)) return false;
        const v = ex(F(e, 'right'));
        return v != null && say(`${op === '+=' ? 'increase' : 'decrease'} ${left.text} by ${v}`);
      }
      if (e.type === 'update_expression') {
        const arg = F(e, 'argument');
        if (!isChain(arg)) return false;
        return say(`${e.text.includes('++') ? 'increase' : 'decrease'} ${arg.text}`);
      }
      return false;
    }

    function one(n, depth, lvl = 0) {
      const say = (t) => { o.say(depth, t); return true; };
      if (lvl && n.type !== 'lexical_declaration' && n.type !== 'expression_statement') return false;
      switch (n.type) {
        case 'expression_statement': {
          const e = named(n)[0], c = e && e.type === 'await_expression' ? named(e)[0] : e;
          if (e && e.type === 'string' && /^use strict$/.test(e.text.slice(1, -1))) return say('use strict rules');
          // (function () { … })(): run straight away, with names of its own
          // (one input, given a value: (function (root) { … })(window) is "with root set to window")
          const wrapped = e && e.type === 'call_expression' && args(e).length <= 1 && F(e, 'function').type === 'parenthesized_expression' ? named(F(e, 'function'))[0] : null;
          const wps = wrapped && /^function(?:_expression)?$/.test(wrapped.type) ? named(F(wrapped, 'parameters')).filter(x => !isComment(x)) : null;
          const given = wps && wps.length === 1 && wps[0].type === 'identifier' && args(e).length === 1 ? item(ex(args(e)[0])) : null;
          if (!lvl && wps && !F(wrapped, 'name') && !kids(wrapped).some(k => k.type === 'async' || k.type === '*') && wps.length === args(e).length && (!wps.length || given != null) && !/keeping its names private/.test(given || '')) {
            say(`run this now, ${wps.length ? `with ${wps[0].text} set to ${given}, ` : ''}keeping its names private`);
            inside(null, () => block(named(F(wrapped, 'body')), depth + 1, n.startIndex));
            return true;
          }
          // running a tool of this file: the writer may wait for it (await) where the code doesn't, or the other way round
          if (c && c.type === 'call_expression' && fileFns.has(F(c, 'function').text)) o.careful.add(n.startIndex);
          return exprStmt(e, depth, lvl);
        }
        case 'lexical_declaration': {
          const d = named(n).filter(x => x.type === 'variable_declarator');
          if (d.length !== 1 || F(d[0], 'name').type !== 'identifier' || !F(d[0], 'value')) return false;
          const name = F(d[0], 'name').text, v = F(d[0], 'value');
          const constant = kids(n)[0].type === 'const';
          const t = v.text.replace(/\s+/g, '');
          const fetchUrl = () => { const f = v.descendantsOfType('call_expression').find(c => F(c, 'function').text === 'fetch'); return f && args(f).length === 1 ? ex(args(f)[0]) : null; };
          o.careful.add(n.startIndex);
          // a little tool kept under a name: "constant double is a tool using n giving back n times 2", or its steps under it
          if (v.type === 'arrow_function' && !lvl) {
            const ps = F(v, 'parameter') ? [F(v, 'parameter').text] : paramList(v), body = F(v, 'body');
            const head = ps && `${constant ? 'constant' : 'set'} ${name} ${constant ? 'is' : 'to'} a tool${ps.length ? ' using ' + ps.join(', ') : ''}`;
            if (head && body.type === 'statement_block') { say(head); inside(null, () => block(named(body), depth + 1, n.startIndex)); return true; }
            const g = head ? val(body) : null;
            if (g != null && !/\sgiving back\s/.test(g)) return say(`${head} giving back ${g}`);
          }
          // a timer kept under a name, so "stop …" can stop it (the writer makes it with let)
          const tm = !constant && !lvl ? timerOf(v) : null;
          if (tm) { say(`${tm.every ? 'every' : 'after'} ${tm.secs} seconds as ${name}`); block(tm.h.body, depth + 1, n.startIndex); return true; }
          // Mechanics writes let for these sentences, const for "constant …", and const for a fetched reply
          // unless a later line changes it. When that doesn't match the original, say let/const outright.
          if (lvl || constant) {
            if (constant && !lvl && /^await\(awaitfetch\(.+\)\)\.json\(\)$/.test(t)) {
              const sent = sendOf(v.descendantsOfType('call_expression').find(c => F(c, 'function').text === 'fetch'));
              if (sent) return say(`send ${sent.v} to ${sent.u} and store the reply in ${name}`);
              const u = fetchUrl(); return u != null && say(`fetch from ${u} and store in ${name}`);
            }
            // a new element: "make a new list item and store in item" (the writer keeps it with const unless it changes)
            if (constant && !lvl && v.type === 'call_expression' && F(v, 'function').text === 'document.createElement' && args(v).length === 1 && /^(["'])[a-z0-9]+\1$/.test(args(v)[0].text) && MADE_WORD[args(v)[0].text.slice(1, -1)]) return say(`make a new ${MADE_WORD[args(v)[0].text.slice(1, -1)]} and store in ${name}`);
            const e = val(v);
            return e != null && say(constant ? `constant ${name} is ${e}` : `set ${name} to ${e}`);
          }
          const id = v.type === 'member_expression' ? elId(F(v, 'object')) : null;
          if (id && /^(value|textContent)$/.test(F(v, 'property').text) && (F(v, 'property').text === 'value') === isField(id)) return say(`get the text of ${id} and store in ${name}`);
          let m;
          if ((m = t.match(/^JSON\.parse\(localStorage\.getItem\((.+)\)\)$/)) && v.type === 'call_expression') { const k = ex(args(args(v)[0])[0]); return k != null && say(`load ${k} from the browser and store in ${name}`); }
          if (/^await\(awaitfetch\(.+\)\)\.json\(\)$/.test(t)) { const u = fetchUrl(); return u != null && say(`fetch from ${u} and store in ${name}`); }
          if (v.type === 'call_expression' && F(v, 'function').text === 'prompt' && args(v).length === 1) { const q = ex(args(v)[0]); return q != null && say(`ask ${q} and store in ${name}`); }
          const e = val(v);
          return e != null && say(`set ${name} to ${e}`);
        }
        case 'if_statement': {
          const c = ex(named(F(n, 'condition'))[0]);
          if (c == null) return false;
          say(`if ${c}`);
          block(bodyOf(F(n, 'consequence')), depth + 1, n.startIndex);
          let alt = F(n, 'alternative');
          while (alt) {
            const inner = named(alt).filter(x => !isComment(x))[0];
            if (inner && inner.type === 'if_statement') {
              const c2 = ex(named(F(inner, 'condition'))[0]);
              if (c2 == null) return false;
              say(`otherwise if ${c2}`);
              o.parents.set(inner.startIndex, n.startIndex);
              block(bodyOf(F(inner, 'consequence')), depth + 1, n.startIndex);
              alt = F(inner, 'alternative');
            } else { say('otherwise'); block(bodyOf(inner), depth + 1, n.startIndex); alt = null; }
          }
          return true;
        }
        case 'for_in_statement': {
          const kind = kids(n).find(x => x.type === 'const' || x.type === 'let');
          if (!kind || !kids(n).some(x => x.type === 'of') || F(n, 'left').type !== 'identifier') return false;
          const list = ex(F(n, 'right'));
          if (list == null) return false;
          say(`for each ${F(n, 'left').text} in ${list}`);
          inside('loop', () => block(bodyOf(F(n, 'body')), depth + 1, n.startIndex));
          return true;
        }
        case 'do_statement': {
          const c = ex(named(F(n, 'condition'))[0]);
          if (c == null || F(n, 'body').type !== 'statement_block') return false;
          say(`do this, then repeat while ${c}`);
          inside('loop', () => block(named(F(n, 'body')), depth + 1, n.startIndex));
          return true;
        }
        // "depending on x", "when it is 1 or 2", "otherwise", "go on into the next case": as C++ says it
        case 'switch_statement': {
          const c = ex(named(F(n, 'value'))[0]), body = F(n, 'body');
          if (c == null || named(body).some(isComment)) return false;
          const cases = named(body), plan = [];
          let pending = [];
          for (let k = 0; k < cases.length; k++) {
            const cs = cases[k], val = F(cs, 'value'), last = k === cases.length - 1;
            const label = val ? ex(val) : null;
            if (val && (label == null || /\sor\s/.test(topOf(label)))) return false;
            if (val) o.parents.set(val.startIndex, n.startIndex);
            let stmts = named(cs).filter(x => !(val && x.startIndex === val.startIndex && x.type === val.type));
            const real = () => stmts.filter(x => !isComment(x));
            if (!real().length && !last) { if (!val || stmts.length) return false; pending.push(label); continue; }   // case 1: case 2: … is "when it is 1 or 2"
            if (!val && pending.length) return false;
            if (real().length === 1 && real()[0].type === 'statement_block') return false;   // a case in braces stays code
            const r = real(), end = r[r.length - 1];
            let fall = false;
            if (end && end.type === 'break_statement' && !named(end).length) {
              if (r.length > 1 && JUMP.test(r[r.length - 2].type)) return false;   // break after give back: the writer adds none
              stmts = stmts.filter(x => x !== end);
            } else if (end && JUMP.test(end.type)) { /* it leaves by itself */ }
            else if (!last) fall = true;   // no break: JavaScript carries on into the next case
            plan.push({ head: val ? `when it is ${[...pending, label].join(' or ')}` : 'otherwise', stmts, fall });
            pending = [];
          }
          if (!plan.length) return false;
          say(`depending on ${c}`);
          for (const p of plan) {
            o.say(depth + 1, p.head);
            inside('case', () => block(p.stmts, depth + 2, n.startIndex));
            if (p.fall) o.say(depth + 2, 'go on into the next case');
          }
          return true;
        }
        // a class: "define class Store", "when a new Store is made with key", "define load", each part on its own
        case 'class_declaration': {
          const name = F(n, 'name'), heritage = kids(n).find(k => k.type === 'class_heritage');
          const base = heritage ? named(heritage)[0] : null;
          if (!name || (heritage && (named(heritage).length !== 1 || !isChain(base)))) return false;
          say(`define class ${name.text}${base ? ' based on ' + base.text : ''}`);
          walkBlock(o, named(F(n, 'body')), depth + 1, n.startIndex, force, 'js:', src, (mem, d, lv) => {
            if (lv || mem.type !== 'method_definition' || kids(mem).some(k => /^(?:static|get|set|\*)$/.test(k.type)) || F(mem, 'name').type !== 'property_identifier') return false;
            const ps = paramList(mem);
            if (ps == null) return false;
            const m = F(mem, 'name').text;
            o.say(d, m === 'constructor' ? `when a new ${name.text} is made${ps.length ? ' with ' + ps.join(', ') : ''}` : `define ${m}${ps.length ? ' using ' + ps.join(', ') : ''}`);
            inside(null, () => block(named(F(mem, 'body')), d + 1, mem.startIndex));
            return true;
          });
          return true;
        }
        case 'import_statement': {
          const clause = named(n).find(x => x.type === 'import_clause'), from = F(n, 'source');
          const list = clause && named(clause).length === 1 && named(clause)[0].type === 'named_imports' ? named(named(clause)[0]).filter(x => !isComment(x)) : null;
          if (!list || !list.length || !from || list.some(s => s.type !== 'import_specifier' || named(s).length !== 1)) return false;
          const ns = list.map(s => s.text);
          return say(`bring in ${ns.length > 1 ? ns.slice(0, -1).join(', ') + ' and ' + ns[ns.length - 1] : ns[0]} from ${from.text}`);
        }
        case 'for_statement': {
          const t = `${F(n, 'initializer').text}|${(F(n, 'condition') || { text: '' }).text}|${(F(n, 'increment') || { text: '' }).text}`.replace(/\s+/g, '');
          const m = t.match(/^let([A-Za-z_$][\w$]*)=0;\|([A-Za-z_$][\w$]*)<(.+);\|([A-Za-z_$][\w$]*)\+\+$/);
          if (!m || m[1] !== m[2] || m[1] !== m[4]) return false;
          const cond = F(n, 'condition');
          const right = cond.type === 'expression_statement' ? F(named(cond)[0], 'right') : F(cond, 'right');
          const N = ex(right);
          if (N == null) return false;
          say(`repeat ${N} times${m[1] === 'i' ? '' : ' counting with ' + m[1]}`);
          inside('loop', () => block(bodyOf(F(n, 'body')), depth + 1, n.startIndex));
          return true;
        }
        case 'while_statement': {
          const c = ex(named(F(n, 'condition'))[0]);
          if (c == null) return false;
          say(`while ${c}`);
          inside('loop', () => block(bodyOf(F(n, 'body')), depth + 1, n.startIndex));
          return true;
        }
        case 'function_declaration': {
          const ps = paramList(n);
          if (ps == null || kids(n).some(k => k.type === '*')) return false;
          say(`define ${F(n, 'name').text}${ps.length ? ' using ' + ps.join(', ') : ''}`);
          inside(null, () => block(named(F(n, 'body')), depth + 1, n.startIndex));
          return true;
        }
        case 'throw_statement': {
          const v = named(n).filter(x => !isComment(x))[0], a = v && v.type === 'new_expression' && F(v, 'constructor').text === 'Error' && F(v, 'arguments') ? args(v) : null;
          if (!a || a.length !== 1) return false;
          const e = ex(a[0]);
          return e != null && say(`fail with ${e}`);
        }
        case 'try_statement': {
          const h = F(n, 'handler'), fin = F(n, 'finalizer'), param = h && F(h, 'parameter');
          if (param && param.type !== 'identifier') return false;
          say('try');
          block(named(F(n, 'body')), depth + 1, n.startIndex);
          if (h) { say(`if it fails${param ? ' as ' + param.text : ''}`); block(named(F(h, 'body')), depth + 1, n.startIndex); }
          if (fin) { say('in any case'); block(named(F(fin, 'body')), depth + 1, n.startIndex); }
          return true;
        }
        case 'return_statement': { const v = named(n).filter(x => !isComment(x))[0]; if (!v) return say('give back'); const e = val(v); return e != null && say(`give back ${e}`); }
        // (inside "depending on", break ends the case, not a loop: it stays code)
        case 'break_statement': return !named(n).length && breakIn !== 'case' && say('stop the loop');
        case 'continue_statement': return !named(n).length && say('skip to next');
        default: return false;
      }
    }
    walkBlock(o, named(tree), 0, null, force, 'js:', src, one);
    return o;
  }

  /* What counts as the same JavaScript. Every rule here keeps the meaning:
     brackets around one expression (the tree already says what goes with what, except that brackets
     stop a ?. chain, so those stay), x++ and ++x as a statement of their own, and one-line bodies
     written with or without braces. let and const differ (const can't change), and so do x++ and
     x += 1 (for text "5", x++ gives 6 but x += 1 gives "51"). */
  const JS_RULES = {
    skip: (c) => c.type === ';' || c.type === '{' || c.type === '}',
    rewrite: (n) => {
      if (n.type === 'parenthesized_expression' && n.namedChildCount === 1 && !n.namedChild(0).descendantsOfType('optional_chain').length) return { node: n.namedChild(0) };
      // 'click' and "click" are the same text (as Python's check counts them); one with quotes or \ inside is compared as written
      if (n.type === 'string' && !/[\\'"]/.test(n.text.slice(1, -1))) return { t: 'string', k: n.startIndex, v: n.text.slice(1, -1) };
      if (n.type === 'expression_statement' && n.namedChild(0) && n.namedChild(0).type === 'update_expression') {
        const u = n.namedChild(0), a = F(u, 'argument');
        return { t: 'expression_statement', k: n.startIndex, c: [{ t: 'update', v: u.text.includes('++') ? '+' : '-', c: [normalise(a, JS_RULES)] }] };
      }
      return null;
    },
    // (a class's parts are compared one by one, so one that differs is kept as code on its own)
    block: (n) => n.type === 'program' || n.type === 'statement_block' || n.type === 'class_body',
    after: (o, n) => {
      // a comma after the last item changes nothing: [1, 2,], f(a,), { a: 1, } (but [1, ,] has a hole, and [,] one item)
      if (/^(?:object|array|arguments|formal_parameters|named_imports|object_pattern|array_pattern)$/.test(n.type)) {
        const end = o.c.length - (o.c.length && /^[)\]]$/.test(o.c[o.c.length - 1].t) ? 2 : 1);   // (braces are skipped; ] and ) aren't)
        if (end > 0 && o.c[end].t === ',' && !/^[[(,]$/.test(o.c[end - 1].t)) o.c.splice(end, 1);
      }
      // (x) => … and x => … are the same little function
      if (n.type === 'arrow_function') {
        const i = o.c.findIndex(x => x.t === 'formal_parameters');
        if (i >= 0 && o.c[i].c.length === 3 && o.c[i].c[1].t === 'identifier') o.c[i] = o.c[i].c[1];
      }
      // a break that ends a switch's last case does nothing
      if (n.type === 'switch_statement') {
        const body = o.c.find(x => x.t === 'switch_body'), last = body && body.c[body.c.length - 1];
        if (last && /^switch_(?:case|default)$/.test(last.t) && last.c.length && last.c[last.c.length - 1].t === 'break_statement' && last.c[last.c.length - 1].c && last.c[last.c.length - 1].c.length === 1) last.c.pop();
      }
      // () => f(x) as a listener or a timer is () => { f(x); }: nothing reads what a listener or a timer gives back
      if (n.type === 'arrow_function' && F(n, 'body') && F(n, 'body').type !== 'statement_block' && F(n, 'body').type !== 'update_expression' && n.parent && n.parent.type === 'arguments') {
        const call = n.parent.parent, fn = call && F(call, 'function'), list = named(n.parent).filter(x => !isComment(x));
        const listener = fn && fn.type === 'member_expression' && F(fn, 'property').text === 'addEventListener' && list[1] && list[1].startIndex === n.startIndex;
        const timer = fn && (/^(?:setTimeout|setInterval)$/.test(fn.text) || (fn.type === 'member_expression' && F(fn, 'property').text === 'forEach')) && list[0] && list[0].startIndex === n.startIndex;
        const body = F(n, 'body'), i = o.c.findIndex(x => x.k === body.startIndex && x.t === body.type);
        if ((listener || timer) && i >= 0) o.c[i] = { t: 'statement_block', k: body.startIndex, block: true, c: [{ t: 'expression_statement', k: body.startIndex, c: [o.c[i]] }] };
      }
      if (/^(if_statement|for_statement|for_in_statement|while_statement|do_statement)$/.test(n.type)) wrapBodies(o, n, ['consequence', 'body'], 'statement_block');
      if (n.type === 'else_clause') { const c = named(n).find(x => !isComment(x)); if (c && c.type !== 'statement_block' && c.type !== 'if_statement') { const i = o.c.findIndex(x => x.k === c.startIndex); if (i >= 0) o.c[i] = { t: 'statement_block', k: c.startIndex, block: true, c: [o.c[i]] }; } }
    },
  };

  /* ================================================================== */
  /* CSS                                                                 */
  /* ================================================================== */

  const TAG_PHRASE = { button: 'buttons', 'h1, h2, h3': 'headings', h1: 'big headings', a: 'links', p: 'paragraphs', img: 'pictures', 'input, textarea': 'text boxes', 'ul, ol': 'lists', li: 'list items', section: 'sections', body: 'the page', '*': 'everything', header: 'header', footer: 'footer', nav: 'navigation bar', form: 'forms', label: 'labels', input: 'inputs' };
  const COMBOS = { 'display:flex;align-items:center': 'in a row', 'display:flex;flex-direction:column': 'in a column', 'margin-left:auto;margin-right:auto': 'centred', 'position:sticky;top:0': 'stays in place', 'background-image:url(': null };
  const PSEUDO = { hover: 'hovered', active: 'clicked', focus: 'focused', checked: 'selected', 'focus-visible': 'focused with the keyboard', disabled: 'disabled', visited: 'visited', empty: 'empty' };
  const HTML_TAG = /^(?:a|abbr|address|article|aside|audio|b|blockquote|body|button|canvas|caption|code|dd|details|dialog|div|dl|dt|em|fieldset|figcaption|figure|footer|form|h[1-6]|header|hr|html|i|iframe|img|input|kbd|label|legend|li|main|mark|menu|nav|ol|optgroup|option|output|p|picture|pre|progress|q|s|section|select|small|span|strong|sub|summary|sup|svg|table|tbody|td|textarea|tfoot|th|thead|time|tr|u|ul|video)$/;

  /* One declaration as a style phrase that the Styling translator turns back into exactly [prop, value]. */
  function stylePhrase(prop, value, WEB) {
    const tries = [];
    const px = value.match(/^(-?\d+(?:\.\d+)?)px$/);
    const short = px ? px[1] : value;
    const P = {
      background: [`background ${value}`], 'background-color': [], color: [`text colour ${value}`], 'font-size': [`text size ${short}`], 'font-weight': value === 'bold' ? ['bold'] : [],
      'font-style': value === 'italic' ? ['italic'] : [], 'text-transform': value === 'uppercase' ? ['capitals'] : [], padding: [`space inside ${value.split(/\s+/).map(v => v.replace(/^(-?\d+(?:\.\d+)?)px$/, '$1')).join(' ')}`],
      margin: [`space around ${value.split(/\s+/).map(v => v.replace(/^(-?\d+(?:\.\d+)?)px$/, '$1')).join(' ')}`], 'border-radius': value === '50%' ? ['round'] : [`rounded corners ${short}`], border: value === 'none' ? ['no border'] : [],
      'box-shadow': value === 'none' ? ['no shadow'] : [], display: value === 'none' ? ['hidden'] : [], width: [`width ${short}`], height: [`height ${short}`], 'max-width': [`at most ${short} wide`], 'min-height': [`at least ${short} tall`],
      gap: [`gap ${short}`], 'justify-content': value === 'space-between' ? ['spread out'] : [], cursor: value === 'pointer' ? ['hand cursor'] : [], 'text-decoration': value === 'none' ? ['no underline'] : [], 'text-align': value === 'center' ? ['centred text'] : [],
      opacity: /^0?\.\d+$|^[01]$/.test(value) ? [`${Math.round((1 - parseFloat(value)) * 100)}% see-through`] : [],
      'font-family': (value.match(/^"([^"]+)", sans-serif$/) || [])[1] ? [`font ${value.match(/^"([^"]+)"/)[1]}`] : (value.match(/^"([^"]+)", (serif|monospace|cursive)$/) || [])[1] ? [`font ${value.match(/^"([^"]+)"/)[1]} or any ${value.match(/, (\w+)$/)[1]} font`] : [],
      'line-height': [`line height ${value}`], 'letter-spacing': [`letter spacing ${short}`], 'box-sizing': value === 'border-box' ? ['size includes padding plus border'] : [],
    };
    const shared = value.match(/^var\(--([a-z][a-z0-9-]*)\)$/);   // a shared colour: "the colour crust"
    if (shared && (prop === 'color' || prop === 'background')) tries.push(`${prop === 'color' ? 'text colour' : 'background'} the colour ${shared[1]}`);
    if (prop === 'font-weight' && /^\d{3}$|^(?:normal|lighter|bolder)$/.test(value)) tries.push(`text weight ${value}`);
    if (prop === 'text-align' && /^(?:left|right|justify|start|end)$/.test(value)) tries.push(`text aligned ${value}`);
    if (prop === 'text-decoration' && value === 'underline') tries.push('underlined');
    if (prop === 'text-decoration' && value === 'line-through') tries.push('struck through');
    const grad = prop === 'background' && value.match(/^linear-gradient\((?:(-?\d+(?:\.\d+)?deg), )?([^()]+)\)$/);
    if (grad) { const cs = grad[2].split(', '); if (cs.length >= 2 && cs.every(c => /^(?:#[0-9a-f]{3,8}|[a-z]+)$/.test(c))) tries.push(`background gradient${grad[1] ? ' at ' + grad[1] : ''} from ${cs[0]}${cs.slice(1, -1).map(c => ' through ' + c).join('')} to ${cs[cs.length - 1]}`); }
    const line = prop.match(/^(border|outline)(?:-(top|bottom|left|right))?$/);
    if (line && value !== 'none') {   // "border 2 dashed navy", "bottom border 1 solid #ddd"
      tries.push(`${line[2] ? line[2] + ' ' : ''}${line[1]} ${value.replace(/(^|\s)(-?\d*\.?\d+)px(?=\s|$)/g, '$1$2')}`);
    }
    if (line && value === 'none' && !line[2]) tries.push(`no ${line[1]}`);
    tries.push(...(P[prop] || []), `${prop}: ${value}`);
    for (const t of tries) {
      const inf = { notes: [], warns: [], errs: [] };
      const got = WEB.cssPropsFor(t, inf);
      if (!inf.errs.length && got.length === 1 && got[0][0] === prop && got[0][1] === value) return t;
    }
    return null;
  }

  function cssConvert(src, env, force) {
    const tree = env.parse('css', src);
    const o = Out();
    const ids = env.ids || {}, groups = new Set(env.groups || []);
    const WEB = env.WEB;
    const selPhrase = (sel) => {
      const s = collapseCode(sel);
      let m;
      if (/:/.test(s)) return null;
      if ((m = s.match(/^#([\w-]+)$/))) return ids[m[1]] && simpleName(m[1]) && !TAG_PHRASE[m[1]] && !WEB.TAG_WORDS[m[1]] && !HTML_TAG.test(m[1]) && !/^(?:every|group|element|the)\b/.test(m[1]) ? m[1] : s;
      if ((m = s.match(/^\.([\w-]+)$/))) return simpleName(m[1]) ? `group ${m[1]}` : s;
      if (TAG_PHRASE[s] && !ids[s]) return TAG_PHRASE[s];
      if (WEB.TAG_WORDS[s]) return null;
      if (HTML_TAG.test(s) && !ids[s] && !groups.has(s)) return s;
      if (/^[a-z0-9]+(?:, [a-z0-9]+)+$/.test(s) && s.split(', ').every(t => HTML_TAG.test(t))) return s;
      if (/^[.#*\[]/.test(s) || /[>~+\[]/.test(s) || /^[a-z]+[.#]/.test(s)) return s;
      return null;
    };
    const decls = (blockNode) => {
      const out = [];
      for (const d of named(blockNode)) {
        if (isComment(d)) continue;
        if (d.type !== 'declaration') return null;
        const t = d.text.replace(/;\s*$/, '');
        const i = t.indexOf(':');
        out.push([t.slice(0, i).trim().toLowerCase(), collapseCode(t.slice(i + 1))]);
      }
      return out;
    };
    const ruleSentence = (rule) => {
      const selNode = named(rule).find(x => x.type === 'selectors'), blockNode = named(rule).find(x => x.type === 'block');
      if (!selNode || !blockNode) return null;
      const ds = decls(blockNode);
      if (!ds || !ds.length) return null;
      const phrases = [];
      for (let i = 0; i < ds.length; i++) {   // pairs that read as one phrase
        const pair = i + 1 < ds.length ? `${ds[i][0]}:${ds[i][1]};${ds[i + 1][0]}:${ds[i + 1][1]}` : '';
        const combo = COMBOS[pair] || (pair.match(/^display:grid;grid-template-columns:repeat\((\d+), 1fr\)$/) ? `in a grid of ${pair.match(/repeat\((\d+)/)[1]} columns` : null);
        if (combo) { phrases.push(combo); i++; continue; }
        phrases.push(stylePhrase(ds[i][0], ds[i][1], WEB));
      }
      if (phrases.some(p => p == null)) return null;
      const props = phrases.join(', ');
      const inf = { notes: [], warns: [], errs: [] };
      const back = WEB.cssPropsFor(props, inf);
      if (inf.errs.length || JSON.stringify(back) !== JSON.stringify(ds)) return null;
      const sel = collapseCode(selNode.text);
      const pm = sel.match(/^([^:\s]+):(hover|active|focus|checked|focus-visible|disabled|visited|empty|focus-within)$/);
      if (pm) { const who = selPhrase(pm[1]); return who ? pm[2] === 'focus-within' ? `when ${who} has focus inside: ${props}` : `when ${who} is ${PSEUDO[pm[2]]}: ${props}` : null; }
      const pe = sel.match(/^([^:]+)::(before|after)$/);   // a piece CSS adds at the start or end
      if (pe) { const who = selPhrase(pe[1]); return who ? `${pe[2]} ${who}: ${props}` : null; }
      const who = selPhrase(sel);
      return who ? `style ${who}: ${props}` : null;
    };
    function one(n, depth) {
      if (n.type === 'rule_set') {
        const sel = collapse((named(n).find(x => x.type === 'selectors') || { text: '' }).text);
        if (sel === ':root' && depth === 0) {
          const ds = decls(named(n).find(x => x.type === 'block'));
          if (!ds || !ds.length || !ds.every(([p]) => /^--[a-z][a-z0-9-]*$/.test(p) && simpleName(p.slice(2)))) return false;
          for (const [p, v] of ds) {
            const inf = { notes: [], warns: [], errs: [] };
            if (WEB.colorFor(v, inf) !== v || inf.errs.length) return false;
            o.say(depth, `shared colour ${p.slice(2)} is ${v}`);
          }
          return true;
        }
        const s = ruleSentence(n);
        if (!s) return false;
        o.say(depth, s);
        return true;
      }
      if (n.type === 'media_statement' && depth === 0) {
        const q = collapse(src.slice(n.startIndex, named(n).find(x => x.type === 'block').startIndex).replace(/^@media/, ''));
        let m, head;
        if ((m = q.match(/^\(max-width: (\d+(?:\.\d+)?(?:px|em|rem))\)$/))) head = `on screens narrower than ${m[1]}`;
        else if ((m = q.match(/^\(min-width: (\d+(?:\.\d+)?(?:px|em|rem))\)$/))) head = `on screens wider than ${m[1]}`;
        else if (q === '(prefers-color-scheme: dark)') head = 'in dark mode';
        else return false;
        o.say(depth, head + ':');
        walkBlock(o, named(named(n).find(x => x.type === 'block')), depth + 1, n.startIndex, force, 'css:', src, one);
        return true;
      }
      return false;
    }
    walkBlock(o, named(tree), 0, null, force, 'css:', src, one);
    return o;
  }

  const CSS_RULES = {
    skip: (c) => c.type === ';',
    exactGaps: (n) => n.type === 'string_value',   // "  " is a different string from " "
    block: (n) => n.type === 'stylesheet' || (n.type === 'block' && n.parent && /media_statement|supports_statement/.test(n.parent.type)),
  };

  /* ================================================================== */
  /* HTML                                                                */
  /* ================================================================== */

  const tagOf = (el) => { const st = named(el).find(x => x.type === 'start_tag' || x.type === 'self_closing_tag'); const t = st && named(st).find(x => x.type === 'tag_name'); return t ? t.text.toLowerCase() : ''; };
  const attrsOf = (el, strict) => {
    const st = named(el).find(x => x.type === 'start_tag' || x.type === 'self_closing_tag');
    return st ? named(st).filter(x => x.type === 'attribute').map(a => {
      const nm = named(a).find(x => x.type === 'attribute_name');
      const val = named(a).find(x => x.type === 'quoted_attribute_value' || x.type === 'attribute_value');
      const raw = val ? (val.type === 'quoted_attribute_value' ? (named(val)[0] ? named(val)[0].text : '') : val.text) : null;
      return { name: nm.text.toLowerCase(), rawName: nm.text, value: raw == null ? null : decode(raw, strict), text: a.text };
    }) : [];
  };
  const childNodes = (el) => named(el).filter(x => !/^(start_tag|end_tag|self_closing_tag|erroneous_end_tag)$/.test(x.type));
  const isEl = (n) => /^(element|script_element|style_element)$/.test(n.type);
  /* The text inside an element, from the source (so spaces around &amp; and friends are kept). */
  const textOf = (el, strict) => {
    const st = named(el).find(x => x.type === 'start_tag'), et = named(el).find(x => x.type === 'end_tag');
    const inner = childNodes(el);
    if (!inner.length) return '';
    const from = st ? st.endIndex : inner[0].startIndex, to = et ? et.startIndex : inner[inner.length - 1].endIndex;
    return decode(el.text.slice(from - el.startIndex, to - el.startIndex).replace(/<!--[\s\S]*?-->/g, ''), strict);
  };
  /* Where an element really ends: without an end tag (<img>, <input>…) the parser counts the spaces after it in too. */
  const endOf = (n) => { if (!isEl(n) || named(n).some(x => x.type === 'end_tag')) return n.endIndex; const k = named(n); return k.length ? k[k.length - 1].endIndex : n.endIndex; };
  const onlyText = (el) => childNodes(el).every(c => c.type === 'text' || c.type === 'entity');
  const isBlankText = (n) => (n.type === 'text' && !n.text.trim());
  const getAttr = (a, k) => (a.find(x => x.name === k) || {}).value;

  /* Spaces in HTML. Browsers show a run of spaces and line breaks as one space, and only where it sits
     between two inline things (text, links, pictures, buttons…). Next to a block (a paragraph, a
     section, a list item…) or at the inner edge of one, it doesn't show. Inside <pre> and <textarea>
     every space shows. Elements not listed count as inline, so no space that might show is dropped. */
  const BLOCK = /^(?:html|head|body|address|article|aside|blockquote|center|details|dialog|dd|div|dl|dt|fieldset|figcaption|figure|footer|form|h[1-6]|header|hgroup|hr|li|main|nav|ol|p|pre|search|section|table|tbody|thead|tfoot|tr|td|th|caption|colgroup|col|ul|summary|legend|menu|optgroup|option|br|title|meta|link|base|listing)$/;
  const OWN_BOX = /^(?:button|select|textarea|input|img|video|audio|canvas|iframe|object|embed|meter|progress|svg|math)$/;   // inline, but spaces at their inner edges don't show
  const KEEPS_SPACES = /^(?:pre|textarea|listing|xmp|plaintext)$/;
  const SVG_TEXT = /^(?:text|tspan|textpath)$/;   // inside <svg>, only text keeps spaces
  const htmlSpace = (s) => String(s).replace(/[ \t\n\f\r]+/g, ' ');   // not \s: a no-break space stays
  const htmlTrim = (s) => htmlSpace(s).replace(/^ | $/g, '');

  /* The parts of a node's source whose spaces are part of the page: inside <pre>, <textarea>, <script> and <style>. */
  function keepRanges(node) {
    const out = [];
    const walk = (n) => {
      if (n.type === 'script_element' || n.type === 'style_element' || (n.type === 'element' && /^(?:pre|textarea|listing|xmp)$/.test(tagOf(n)))) {
        const st = named(n).find(x => x.type === 'start_tag'), et = named(n).find(x => x.type === 'end_tag');
        if (st) out.push([st.endIndex, et ? et.startIndex : n.endIndex]);
        return;
      }
      for (const c of named(n)) walk(c);
    };
    walk(node);
    return out;
  }

  /* A viewport setting in a comparable form: its settings in any order, 1.0 the same as 1. */
  function viewportKey(content) {
    const m = new Map();
    for (const part of String(content || '').split(/[,;]/)) {
      const [k, ...r] = part.split('='), v = r.join('=').trim().toLowerCase();
      if (k.trim()) m.set(k.trim().toLowerCase(), /^-?\d*\.?\d+$/.test(v) ? String(+v) : v);
    }
    return [...m].sort().map(([k, v]) => `${k}=${v}`).join(',');
  }
  const DEFAULT_VIEWPORT = viewportKey('width=device-width, initial-scale=1');
  /* 'charset', 'viewport' or 'name' for the <meta> settings whose place in the head doesn't matter. */
  const metaKind = (n) => {
    if (!isEl(n) || tagOf(n) !== 'meta') return null;
    const a = attrsOf(n);
    if (a.some(x => x.name === 'charset')) return 'charset';
    if (getAttr(a, 'name') == null || getAttr(a, 'http-equiv') != null) return null;
    return String(getAttr(a, 'name')).toLowerCase() === 'viewport' ? 'viewport' : 'name';
  };

  /* <html>, <head>, <body> and what belongs where, even when some tags are left out. */
  function pageParts(tree) {
    const top = named(tree).filter(x => x.type !== 'doctype');
    const html = top.find(x => isEl(x) && tagOf(x) === 'html');
    const inside = html ? childNodes(html) : top;
    const head = inside.find(x => isEl(x) && tagOf(x) === 'head');
    const body = inside.find(x => isEl(x) && tagOf(x) === 'body');
    const loose = inside.filter(x => x !== head && x !== body && !isComment(x) && !isBlankText(x));
    const HEADISH = /^(title|meta|link|base|style)$/;
    return {
      html, head, body,
      headItems: (head ? childNodes(head) : []).concat(body ? [] : loose.filter(x => isEl(x) && HEADISH.test(tagOf(x)))).filter(x => !isBlankText(x)),
      bodyItems: body ? childNodes(body) : loose.filter(x => !(isEl(x) && HEADISH.test(tagOf(x)))).concat(head ? [] : []),
    };
  }

  const CONTAINER_WORD = { section: 'section', header: 'header', footer: 'footer', nav: 'navigation bar', main: 'main area', div: 'block', form: 'form', aside: 'side panel', article: 'article', ul: 'list', ol: 'numbered list', table: 'table', tr: 'row', dialog: 'dialog' };
  const INPUT_WORD = { text: 'text', number: 'number', password: 'password', email: 'email', date: 'date', search: 'search', color: 'colour' };

  function htmlConvert(src, env, force) {
    const tree = env.parse('html', src);
    const o = Out();
    const pulled = new Set(env.pulled || []);
    const p = pageParts(tree);
    // The page's own style sheet (Styling) and script (Mechanics): Structure links style.css at the end
    // of <head> and script.js at the end of <body>. Anywhere else, a head: or html: line says where.
    const ownStyle = (n) => isEl(n) && tagOf(n) === 'link' && /stylesheet/i.test(getAttr(attrsOf(n), 'rel') || '') && pulled.has(getAttr(attrsOf(n), 'href'));
    const ownScript = (n) => n.type === 'script_element' && pulled.has(getAttr(attrsOf(n), 'src')) && !textOf(n).trim();
    const retarget = (n, name, file) => {   // the tag's source with its file name swapped for the project's own
      const st = named(n).find(x => x.type === 'start_tag' || x.type === 'self_closing_tag');
      const at = named(st).find(x => x.type === 'attribute' && named(x).find(y => y.type === 'attribute_name').text.toLowerCase() === name);
      const v = named(at).find(x => x.type === 'quoted_attribute_value' || x.type === 'attribute_value');
      const inner = v.type === 'quoted_attribute_value' ? v.startIndex + 1 : v.startIndex, end = v.type === 'quoted_attribute_value' ? v.endIndex - 1 : v.endIndex;
      return src.slice(n.startIndex, inner) + file + src.slice(end, endOf(n));
    };
    // the first line and the <html> tag
    const doc = named(tree).find(x => x.type === 'doctype');
    if (!doc) o.say(0, 'no doctype');
    else if (collapse(doc.text).toLowerCase() !== '<!doctype html>') o.say(0, `doctype: ${collapse(doc.text)}`);
    const htmlA = p.html ? attrsOf(p.html) : [];
    const lang = htmlA.find(a => a.name === 'lang' && /^[a-z]{2}(?:-[a-z0-9]+)*$/i.test(a.value || ''));
    o.say(0, lang ? `page language is ${lang.value}` : 'no page language');
    if (htmlA.some(a => a !== lang)) o.say(0, `html attributes: ${htmlA.filter(a => a !== lang).map(a => a.text).join(' ')}`);
    const title = p.headItems.find(x => isEl(x) && tagOf(x) === 'title');
    const titleRaw = title && decode(textOf(title), true).includes('\u0001');   // a character code IntuaCode doesn't know: the title stays as code
    o.say(0, title && !titleRaw ? `page title is ${quote(htmlTrim(textOf(title)))}` : 'no title');
    // <head>: the usual settings are said by nothing; everything else is kept as head: lines, in order
    const ordered = p.headItems.filter(h => isEl(h) && tagOf(h) !== 'title' && !metaKind(h));
    const plainStyle = (h) => ownStyle(h) && attrsOf(h).every(a => a.name === 'href' || (a.name === 'rel' && /^stylesheet$/i.test(a.value)));
    let tail = ordered.length;
    while (tail > 0 && plainStyle(ordered[tail - 1])) tail--;
    const atEnd = new Set(ordered.slice(tail));   // where Structure puts the Styling link anyway
    const linkKey = (h) => JSON.stringify(attrsOf(h).filter(x => x.name !== 'href').map(x => [x.name, x.value]));
    let usualCharset = false, usualViewport = false;
    for (const h of p.headItems) {
      if (isComment(h)) continue;
      const a = isEl(h) ? attrsOf(h) : [];
      const k = metaKind(h);
      if ((h === title && !titleRaw) || atEnd.has(h)) continue;
      if (k === 'charset' && !usualCharset && a.length === 1 && String(a[0].value).toLowerCase() === 'utf-8') { usualCharset = true; continue; }
      if (k === 'viewport' && !usualViewport && a.length === 2 && viewportKey(getAttr(a, 'content')) === DEFAULT_VIEWPORT) { usualViewport = true; continue; }
      if (ownStyle(h)) {   // style files next to each other were joined into one Styling: one link says where
        const before = ordered[ordered.indexOf(h) - 1];
        if (!(before && ownStyle(before) && linkKey(before) === linkKey(h))) o.rawLines(0, 'head:', src, h, retarget(h, 'href', 'style.css'));
        continue;
      }
      if (ownScript(h)) { o.rawLines(0, 'head:', src, h, retarget(h, 'src', 'script.js')); continue; }
      o.rawLines(0, 'head:', src, h);
    }
    if (!p.headItems.some(h => metaKind(h) === 'charset')) o.say(0, 'leave out the character set');
    if (!p.headItems.some(h => metaKind(h) === 'viewport')) o.say(0, 'leave out the viewport setting');
    let bodyAttrs = p.body ? attrsOf(p.body) : [];
    const bodyClass = bodyAttrs.filter(x => x.name === 'class');   // the page's groups, said as such
    if (bodyClass.length === 1 && bodyClass[0].value && bodyClass[0].value.split(' ').every(c => simpleName(c))) {
      const gs = bodyClass[0].value.split(' ');
      o.say(0, `the page is in group${gs.length > 1 ? 's' : ''} ${gs.join(', ')}`);
      bodyAttrs = bodyAttrs.filter(x => x.name !== 'class');
    }
    if (bodyAttrs.length) o.say(0, `body attributes: ${bodyAttrs.map(x => x.text).join(' ')}`);

    const insideForm = (n) => { for (let q = n.parent; q; q = q.parent) if (isEl(q) && tagOf(q) === 'form') return true; return false; };
    const lastItem = p.bodyItems.filter(x => !isComment(x)).pop();
    const WEB = env.WEB;
    // ids of the drawing parts that shapes are filled with: "filled with the gradient body"
    const refs = {};
    (function walk(n) {
      if (isEl(n)) {
        const t = tagOf(n), id = getAttr(attrsOf(n), 'id');
        const kind = { lineargradient: 'gradient', radialgradient: 'gradient', pattern: 'pattern', clippath: 'clipping shape', mask: 'mask', marker: 'marker' }[t];
        if (kind && id) refs[id] = kind;
      }
      for (const c of named(n)) walk(c);
    })(tree.rootNode || tree);
    /* Inside a drawing (<svg>), and not in a page area (<foreignObject>) in it? */
    const inSvg = (n) => { for (let q = n.parent; q; q = q.parent) if (isEl(q)) { const t = tagOf(q); if (t === 'foreignobject') return false; if (t === 'svg') return true; } return false; };
    const selfClosed = (n) => named(n).some(x => x.type === 'self_closing_tag');

    /* An element's children as sentence items: text and character codes next to each other are one run of
       text; each item knows whether it is glued to the one before it (two inline things with no space between
       them: a line break there would show as a space). */
    function items(list, svg) {
      const out = [];
      for (const n of list) {
        if (n.type === 'text' || n.type === 'entity') {
          const prev = out[out.length - 1];
          if (prev && prev.type === 'run') { prev.nodes.push(n); prev.endIndex = n.endIndex; prev.endPosition = n.endPosition; continue; }   // (only spaces can be between them)
          out.push({ type: 'run', nodes: [n], startIndex: n.startIndex, endIndex: n.endIndex, startPosition: n.startPosition, endPosition: n.endPosition, nextSibling: null, namedChildCount: 0, childCount: 0 });
          continue;
        }
        out.push(n);
      }
      const kept = out.filter(n => !(n.type === 'run' && !htmlTrim(decode(src.slice(n.startIndex, n.endIndex)))));
      const inl = (n) => n.type === 'run' || (isEl(n) && (svg ? SVG_TEXT.test(tagOf(n)) : !BLOCK.test(tagOf(n))));
      let prev = null;
      for (const n of kept) {
        if (isComment(n)) { prev = null; continue; }
        const text = n.type === 'run' ? src.slice(n.startIndex, n.endIndex) : null;
        n.glued = !!(prev && inl(prev) && inl(n) && src.slice(endOf(prev), n.startIndex) === '' &&
          !(prev.type === 'run' && /[ \t\n\f\r]$/.test(src.slice(prev.startIndex, prev.endIndex))) && !(text != null && /^[ \t\n\f\r]/.test(text)));
        prev = n;
      }
      return kept;
    }
    /* A run of text as it reads: spaces as the browser shows them; a space at an edge of the element it is in
       is kept only where it shows (inside a link, not inside a paragraph). null if it holds a character code
       IntuaCode doesn't know. */
    function runText(n, first, last, container) {
      const raw = src.slice(n.startIndex, n.endIndex);
      if (decode(raw, true).includes('\u0001')) return null;
      const ctag = container ? tagOf(container) : 'body';
      const edge = container && !inSvg(container) && ctag !== 'svg' && !BLOCK.test(ctag) && !OWN_BOX.test(ctag);
      const st = container && named(container).find(x => x.type === 'start_tag'), et = container && named(container).find(x => x.type === 'end_tag');
      // the spaces between the element's tags and the text count too, where they show
      const before = first && edge && st ? src.slice(st.endIndex, n.startIndex) : '', after = last && edge && et ? src.slice(n.endIndex, et.startIndex) : '';
      let t = htmlSpace(decode(before + raw + after));
      if (!(first && edge)) t = t.replace(/^ /, '');
      if (!(last && edge)) t = t.replace(/ $/, '');
      return t;
    }
    /* Walk items, saying each one; a chain of glued items is said together or kept together as code. */
    function walk(list, depth, parentKey, container) {
      const svg = container ? inSvg(container) || tagOf(container) === 'svg' : false;
      const its = items(list, svg);
      let prevEnd = null;
      for (let i = 0; i < its.length;) {
        let j = i + 1;
        while (j < its.length && its[j].glued) j++;
        const chain = its.slice(i, j);
        if (prevEnd != null && chain[0].startPosition.row > prevEnd + 1) o.blank();
        prevEnd = chain[chain.length - 1].endPosition.row;
        for (const n of chain) o.parents.set(n.startIndex, parentKey);
        if (chain.length === 1 && isComment(chain[0])) { o.notes(depth, chain[0]); i = j; continue; }
        const m = o.mark();
        let ok = !force.has('ALL');
        for (let k = 0; ok && k < chain.length; k++) {
          const n = chain[k];
          if ((force.get(n.startIndex) || 0) >= 2) { ok = false; break; }
          o.keyStack.push(n.startIndex);
          try { ok = one(n, depth, k > 0, its.indexOf(n) === 0, its.indexOf(n) === its.length - 1, container); } catch (e) { ok = false; }
          o.keyStack.pop();
        }
        if (!ok) {
          o.undo(m);
          const first = chain[0], end = chain[chain.length - 1];
          const node = chain.length === 1 && first.type !== 'run' ? first : { type: 'glued', startIndex: first.startIndex, endIndex: endOf(end), startPosition: first.startPosition, endPosition: end.endPosition, nextSibling: null, namedChildCount: chain.length, childCount: 0, namedChild: (q) => chain[q] };
          o.rawLines(depth, 'html:', src, node);
          for (const n of chain) o.parents.set(n.startIndex, parentKey);
        }
        i = j;
      }
    }

    const nameSaid = (id) => (simpleName(id) ? id : quote(id));
    /* The attributes as phrases after commas: ", hidden from screen readers, controls menu". Width and height
       side by side are one phrase ("sized 320 by 180"), and so are a gradient's end. null if one can't be said. */
    function phrases(list, ctx) {
      let s = '';
      for (let i = 0; i < list.length; i++) {
        const x = list[i], y = list[i + 1];
        const pair = y && [['width', 'height', (a, b) => `sized ${a} by ${b}`], ['x1', 'y1', (a, b) => `starting ${a} across and ${b} down`], ['x2', 'y2', (a, b) => `ending ${a} across and ${b} down`]].find(([p, q]) => x.name === p && y.name === q);
        if (pair && x.value != null && y.value != null) {
          const t = pair[2](x.value, y.value), r = WEB.readAttr(t, ctx);
          if (Array.isArray(r) && r.length === 2 && r[0][0].toLowerCase() === x.name && r[0][1] === x.value && r[1][0].toLowerCase() === y.name && r[1][1] === y.value) { s += ', ' + t; i++; continue; }
        }
        const t = WEB.sayAttr(x.rawName, x.value, ctx);
        if (t == null) return null;
        s += ', ' + t;
      }
      return s;
    }
    const NUM_TOKEN = /^-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[-+]?\d+)?(?:%|px|em|rem)?$/i;
    const num = (v) => (v == null ? null : NUM_TOKEN.test(v) ? v : /^[^"]*$/.test(v) && !/^\s|\s$/.test(v) && v !== '' ? `"${v}"` : null);
    /* The head of a drawing shape after its word ("at 10, 20 with radius 5"), taking the attributes it says. */
    function shapeHead(tag, a, used) {
      const take = (k) => { const x = a.find(y => y.name === k && !used.has(y)); return x && x.value != null ? x : null; };
      const parts = [];
      const both = (k1, k2, fmt) => { const x = take(k1), y = take(k2); if (x && y && num(x.value) && num(y.value)) { parts.push(fmt(num(x.value), num(y.value))); used.add(x); used.add(y); } };
      const q = (k, fmt) => { const x = take(k); if (x && !/["\\]/.test(x.value)) { parts.push(fmt(`"${x.value}"`)); used.add(x); } };
      if (tag === 'line') { const xs = ['x1', 'y1', 'x2', 'y2'].map(take); if (xs.every(x => x && num(x.value))) { parts.push(`from ${num(xs[0].value)}, ${num(xs[1].value)} to ${num(xs[2].value)}, ${num(xs[3].value)}`); xs.forEach(x => used.add(x)); } }
      if (tag === 'circle' || tag === 'ellipse') both('cx', 'cy', (x, y) => `at ${x}, ${y}`);
      if (/^(?:rect|image|use|foreignobject|text|tspan|svg|pattern)$/.test(tag) && !(tag === 'svg' && !inSvgNow)) both('x', 'y', (x, y) => `at ${x}, ${y}`);
      if (tag === 'circle') { const r = take('r'); if (r && num(r.value)) { parts.push(`with radius ${num(r.value)}`); used.add(r); } }
      if (tag === 'ellipse') both('rx', 'ry', (x, y) => `with radii ${x} and ${y}`);
      if (/^(?:rect|image|use|foreignobject|svg|pattern)$/.test(tag)) both('width', 'height', (w, h) => `sized ${w} by ${h}`);
      if (tag === 'path') q('d', (d) => `following ${d}`);
      if (tag === 'polyline' || tag === 'polygon') q('points', (p) => `through ${p}`);
      if (tag === 'use') { const h = take('href') || take('xlink:href'); if (h && h.name === 'href' && /^#[\w-]+$/.test(h.value) && simpleName(h.value.slice(1))) { parts.push(`of ${h.value.slice(1)}`); used.add(h); } }
      return parts.length ? ' ' + parts.join(' ') : '';
    }
    let inSvgNow = false;
    /* A gradient's stops in one go: "from #873044 through #5b1426 at .4 to #350916 at 1". */
    function stopsSaid(n) {
      const kids = childNodes(n).filter(x => !isBlankText(x));
      if (!kids.length || !kids.every(x => isEl(x) && tagOf(x) === 'stop' && !childNodes(x).length)) return null;
      const parts = [];
      for (const [i, s] of kids.entries()) {
        const a = attrsOf(s);
        if (!a.every(x => x.name === 'offset' || x.name === 'stop-color') || a.length !== new Set(a.map(x => x.name)).size) return null;
        const c = getAttr(a, 'stop-color'), off = getAttr(a, 'offset');
        if (c == null || !/^(?:#[0-9a-fA-F]{3,8}|[A-Za-z]+)$/.test(c) || (off != null && !NUM_TOKEN.test(off))) return null;
        parts.push(`${i === 0 ? 'from' : i === kids.length - 1 ? 'to' : 'through'} ${c}${off != null ? ' at ' + off : ''}`);
      }
      if (kids.length === 1 && false) return null;
      return ' ' + parts.join(' ');
    }

    function one(n, depth, glued, first, last, container) {
      const gl = glued ? ', with no space before it' : '';
      if (n.type === 'run') { const t = runText(n, first, last, container); if (t == null || t === '') return false; o.say(depth, quote(t) + gl); return true; }
      if (n.type === 'text' || n.type === 'glued') return false;
      if (ownScript(n)) {   // said by nothing at the very end of the page, where Structure puts it
        if (glued) return false;
        if (n === lastItem && attrsOf(n).length === 1) return true;
        o.rawLines(depth, 'html:', src, n, retarget(n, 'src', 'script.js'));
        return true;
      }
      if (ownStyle(n)) { if (glued) return false; o.rawLines(depth, 'html:', src, n, retarget(n, 'href', 'style.css')); return true; }
      if (n.type !== 'element' && !(n.type === 'script_element' && !textOf(n).trim() && getAttr(attrsOf(n), 'src') != null)) return false;
      const tag = tagOf(n);
      const svg = n.type === 'element' && inSvg(n);
      inSvgNow = svg;
      if (/^(?:pre|textarea|listing|xmp|plaintext|template|noscript|style|title|head|body|html|frameset|frame|math)$/.test(tag) && tag !== 'textarea') return false;
      if (!svg && tag !== 'svg' && selfClosed(n) && !/^(?:area|base|br|col|embed|hr|img|input|link|meta|source|track|wbr)$/.test(tag)) return false;   // <div/> isn't closed in HTML
      const a = attrsOf(n);
      const get = (k) => getAttr(a, k);
      const id = get('id');
      const idOK = id != null && id !== '' && !/[\s"\\]/.test(id) && a.filter(x => x.name === 'id').length === 1;
      const cls = get('class');
      const cl = cls == null ? [] : cls.split(' ');
      const grpOK = cls != null && cl.length > 0 && cl.every(c => simpleName(c)) && a.filter(x => x.name === 'class').length === 1;
      const called = idOK ? ` called ${nameSaid(id)}` : '';
      const grp = grpOK ? ` in group${cl.length > 1 ? 's' : ''} ${cl.join(', ')}` : '';
      const ctx = { tag: n.type === 'script_element' ? 'script' : tag, svg: svg || tag === 'svg', refs };
      const others = (allowed) => phrases(a.filter(x => !(x.name === 'id' && idOK) && !(x.name === 'class' && grpOK) && !allowed.includes(x.name)), ctx);
      const kids = childNodes(n).filter(x => !isBlankText(x));
      const textOnly = onlyText(n) && !decode(textOf(n), true).includes('\u0001');
      // a space at the start or end inside an inline element (a link, a label…) can show, so it is kept
      const text = () => (textOnly ? quote(BLOCK.test(tag) || OWN_BOX.test(tag) || svg ? htmlTrim(textOf(n)) : htmlSpace(textOf(n))) : null);
      const say = (t, more) => { if (more == null) return false; o.say(depth, t + more + gl + grp); return true; };
      const holds = () => { walk(childNodes(n), depth + 1, n.startIndex, n); return true; };

      if (!svg) {
        if (/^h[123]$/.test(tag) && textOnly) { const t = text(); return say(`add a ${{ h1: 'big ', h2: '', h3: 'small ' }[tag]}heading ${t}${called}`, others([])); }
        if (tag === 'p' && textOnly) return say(`add a paragraph${called} ${text()}`, others([]));
        if (tag === 'span' && textOnly && kids.length) return say(`add text${called} ${text()}`, others([]));
        if (tag === 'li' && textOnly && kids.length) return say(`add a list item${called} ${text()}`, others([]));
        if (tag === 'button') {
          const want = n.parent && isEl(n.parent) && tagOf(n.parent) === 'form' ? 'submit' : 'button';
          const type = get('type');
          // the type Structure writes itself: button, or submit directly inside a form; anything else is said
          const implied = type == null ? !(want === 'button' && insideForm(n)) : type === want || (type === 'submit' && !insideForm(n));
          const extra0 = others(implied ? ['type'] : []);
          const extra = extra0 == null ? null : extra0 + (!implied && type == null ? ', of type submit' : '');
          if (textOnly && kids.length) return say(`add a button${called} saying ${text()}`, extra);
          if (extra == null) return false;
          o.say(depth, `add a button${called}${extra}${gl}${grp}`);
          return kids.length ? holds() : true;
        }
        // (an address the sentence would change, like google.com, which "link to" makes https://google.com, is said
        // as it is: ", with href google.com")
        const asIs = (k) => WEB.addressFor(get(k), k) === get(k);
        if (tag === 'a' && get('href') != null && a.filter(x => x.name === 'href').length === 1 && asIs('href')) {
          const h = quote(get('href'));
          if (textOnly && kids.length) return say(`add a link${called} to ${h} saying ${text()}`, others(['href']));
          if (kids.length) { const extra = others(['href']); if (extra == null) return false; o.say(depth, `add a link${called} to ${h}${extra}${gl}${grp}`); return holds(); }
        }
        if (tag === 'img' && get('src') != null && asIs('src')) {
          const s = quote(get('src')), al = get('alt');
          const extra = others(['src', 'alt']);
          return say(`add a picture${called} of ${s}${al ? ' described as ' + quote(al) : ''}`, extra == null ? null : extra + (al == null ? ', with no description' : ''));
        }
        if (tag === 'input') {
          const type = get('type');
          if (type === 'range' || INPUT_WORD[type || 'text']) {
            const used = type === 'text' ? [] : ['type'];   // (<input type="text"> is a text box with its type said: CSS can tell them apart)
            let set = '';
            const mn = get('min'), mx = get('max'), st = get('step'), ph = get('placeholder');
            const isNum = (v) => v != null && /^-?\d+(?:\.\d+)?$/.test(v);
            if (isNum(mn) && isNum(mx)) { set += ` from ${mn} to ${mx}`; used.push('min', 'max'); }
            else if (isNum(mn)) { set += ` at least ${mn}`; used.push('min'); }
            else if (isNum(mx)) { set += ` at most ${mx}`; used.push('max'); }
            if (st === 'any') { set += ' allowing decimals'; used.push('step'); } else if (isNum(st)) { set += ` in steps of ${st}`; used.push('step'); }
            if (ph != null && ph !== '' && type !== 'range') { set = ` with hint ${quote(ph)}` + set; used.push('placeholder'); }
            const word = type === 'range' ? 'slider' : `${INPUT_WORD[type || 'text']} box`;
            return say(`add ${/^[aeiou]/.test(word) ? 'an' : 'a'} ${word}${called}${set}`, others(used));
          }
          return say(`add an input${called}`, others([]));
        }
        if (tag === 'textarea' && !textOf(n)) {
          const ph = get('placeholder');
          if (ph === '') return false;
          return say(`add a big text box${called}${ph != null ? ' with hint ' + quote(ph) : ''}`, others(['placeholder']));
        }
        if (tag === 'textarea') return false;
        if (tag === 'select') {
          const opts = kids;
          if (opts.length && opts.every(x => isEl(x) && tagOf(x) === 'option' && !attrsOf(x).length && onlyText(x) && childNodes(x).length)) {
            const qs = opts.map(x => quote(htmlTrim(textOf(x))));
            if (say(`add a drop-down${called} with ${qs.join(', ')}`, others([]))) return true;
          }
        }
        if (tag === 'label' && textOnly && kids.length && (get('for') == null || simpleName(get('for')))) return say(`add a label${called} ${text()}${get('for') ? ' for ' + get('for') : ''}`, others(['for']));
        if (tag === 'video' && get('src') != null && asIs('src') && a.some(x => x.name === 'controls' && !x.value) && !kids.length) return say(`add a video${called} of ${quote(get('src'))}`, others(['src', 'controls']));
        if (tag === 'canvas' && !kids.length) {
          const w = get('width'), h = get('height');
          const both = w != null && h != null && /^\d+$/.test(w) && /^\d+$/.test(h) && a.findIndex(x => x.name === 'height') === a.findIndex(x => x.name === 'width') + 1;
          return say(`add a drawing area${called}${both ? ` ${w} by ${h}` : ''}`, others(both ? ['width', 'height'] : []));
        }
        if (tag === 'hr' && !idOK) return say('add a line', others([]));
      }
      // any other element, said the general way: its word, name, text or shape, then its attributes
      const word = WEB.elementWord(svg ? (named(named(n).find(x => x.type === 'start_tag' || x.type === 'self_closing_tag')).find(x => x.type === 'tag_name') || {}).text || tag : tag, svg);
      if (!word) return false;
      const used = new Set();
      if (/^(?:lineargradient|radialgradient)$/.test(tag)) { const s = stopsSaid(n); if (s) { const extra = phrases(a.filter(x => !(x.name === 'id' && idOK) && !(x.name === 'class' && grpOK)), ctx); return say(`add ${word}${called}${s}`, extra); } }
      const head = svg || tag === 'svg' ? shapeHead(tag, a, used) : '';
      const extra = phrases(a.filter(x => !(x.name === 'id' && idOK) && !(x.name === 'class' && grpOK) && !used.has(x)), ctx);
      if (extra == null) return false;
      if (n.type === 'script_element') return say(`add a script${called}`, extra);
      if (textOnly && kids.length) return say(`add ${word}${called} ${text()}${head}`, extra);
      o.say(depth, `add ${word}${called}${head}${extra}${gl}${grp}`);
      return kids.length ? holds() : true;
    }
    walk(p.bodyItems, 0, null, p.body || null);
    return o;
  }

  /* HTML as a comparable tree: the doctype, the <html> tag, the title, the <meta> settings (their place
     doesn't matter), the rest of the head in order, the <body> tag and the body, with spaces as the
     browser shows them.
     own: hrefs/srcs of the page's own style sheet and script, compared by where they are, not by name.
     drop: { style, script } leaves those out (the original page has none, and the project's are empty). */
  function htmlTree(src, env, own = [], drop = {}) {
    const tree = env.parse('html', src);
    const p = pageParts(tree);
    own = new Set(own);
    const found = { style: false, script: false };
    const insideForm = (n) => { for (let q = n.parent; q; q = q.parent) if (isEl(q) && tagOf(q) === 'form') return true; return false; };
    const ownKind = (n) => {
      if (!isEl(n)) return null;
      const a = attrsOf(n);
      if (tagOf(n) === 'link' && /stylesheet/i.test(getAttr(a, 'rel') || '') && own.has(getAttr(a, 'href'))) return 'style';
      if (n.type === 'script_element' && own.has(getAttr(a, 'src')) && !textOf(n).trim()) return 'script';
      return null;
    };
    const attrText = (attrs) => attrs.sort((x, y) => (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0)).map(a => `${a[0]}=${JSON.stringify(a[1])}`).join(' ');
    const el = (n, ctx) => {
      const tag = tagOf(n);
      const kind = ownKind(n);
      let attrs = attrsOf(n, true).map(a => [a.name, a.value == null ? '' : a.value]);
      if (kind) {
        found[kind] = true;
        return { t: 'el', v: `(${kind}) ` + attrText(attrs.filter(a => a[0] !== (kind === 'style' ? 'href' : 'src'))), k: n.startIndex };
      }
      // (<input> and <input type="text"> are not counted as the same: CSS like input[type="text"] tells them apart)
      if (tag === 'button' && !attrs.some(a => a[0] === 'form')) {   // with no form to send, a button's type changes nothing
        const i = attrs.findIndex(a => a[0] === 'type');
        const type = i >= 0 ? attrs[i][1] : null;
        if (!insideForm(n)) { if (i >= 0 && (type === 'button' || type === 'submit')) attrs.splice(i, 1); }
        else if (i < 0) attrs.push(['type', 'submit']);
      }
      const o = { t: 'el', v: tag + ' ' + attrText(attrs), k: n.startIndex, block: true, c: [] };
      if (n.type !== 'element') {   // <script> and <style>: the code exactly
        const st = named(n).find(x => x.type === 'start_tag'), et = named(n).find(x => x.type === 'end_tag');
        o.c.push({ t: 'raw', v: st ? src.slice(st.endIndex, et ? et.startIndex : n.endIndex) : '' });
        o.block = false;
        return o;
      }
      o.c = list(n, childNodes(n), n.startIndex, { exact: ctx.exact || KEEPS_SPACES.test(tag), svg: ctx.svg || tag === 'svg' || tag === 'math' }, tag);
      return o;
    };
    // The children of an element with the text between them. Spaces count where they can show.
    const list = (container, items, parentKey, ctx, ctag) => {
      const st = container && named(container).find(x => x.type === 'start_tag'), et = container && named(container).find(x => x.type === 'end_tag');
      let pos = st ? st.endIndex : items.length ? items[0].startIndex : 0;
      const end = et ? et.startIndex : items.length ? endOf(items[items.length - 1]) : pos;
      const segs = [];   // text, element, text, element, …, text (comments left out: the text either side joins up)
      let buf = '', key = null;
      for (const n of items) {
        buf += src.slice(pos, n.startIndex); pos = endOf(n);
        if (isComment(n)) continue;
        if (n.type === 'text' || n.type === 'entity') { buf += n.text; key = key ?? n.startIndex; continue; }
        if (!isEl(n) || (drop.style && ownKind(n) === 'style') || (drop.script && ownKind(n) === 'script')) continue;
        segs.push({ seg: true, text: buf, key }, n);
        buf = ''; key = null;
      }
      segs.push({ seg: true, text: buf + src.slice(pos, end), key });
      const inline = (n) => (ctx.svg ? SVG_TEXT.test(tagOf(n)) : !BLOCK.test(tagOf(n)));   // can a space next to it show?
      const edge = !ctx.svg && !BLOCK.test(ctag) && !OWN_BOX.test(ctag);                  // can a space at the inner edges show?
      const out = [];
      segs.forEach((s, i) => {
        if (!s.seg) { out.push(el(s, ctx)); return; }
        let v = decode(s.text, true);
        const k = parentKey ?? s.key;
        if (ctx.exact) {   // every space counts (the browser drops one line break right after <pre> or <textarea>)
          if (i === 0 && /^(?:pre|textarea|listing)$/.test(ctag)) v = v.replace(/^\n/, '');
          if (v) out.push({ t: 'text', v, k });
          return;
        }
        v = htmlSpace(v);
        if (!v) return;
        const left = i === 0 ? edge : inline(segs[i - 1]), right = i === segs.length - 1 ? edge : inline(segs[i + 1]);
        if (v === ' ') { if (left && right) out.push({ t: 'text', v, k }); return; }
        if (!left) v = v.replace(/^ /, '');
        if (!right) v = v.replace(/ $/, '');
        out.push({ t: 'text', v, k });
      });
      return out;
    };
    // <head>: the title and the <meta> settings are compared on their own; everything else in order
    const head = [], metas = [];
    for (const n of p.headItems) {
      if (!isEl(n) || tagOf(n) === 'title') continue;
      if (metaKind(n)) {
        metas.push(attrText(attrsOf(n).map(a => [a.name, a.name === 'charset' || a.name === 'name' ? String(a.value).toLowerCase() : a.name === 'content' && metaKind(n) === 'viewport' ? viewportKey(a.value) : a.value == null ? '' : a.value])));
        continue;
      }
      const kind = ownKind(n);
      if (kind && drop[kind]) continue;
      const x = el(n, {});
      if (kind === 'style' && head.length && head[head.length - 1].v === x.v) continue;   // style files next to each other became one Styling
      head.push(x);
    }
    const title = p.headItems.find(x => isEl(x) && tagOf(x) === 'title');
    const doc = named(tree).find(x => x.type === 'doctype');
    return {
      doctype: doc ? collapse(doc.text).toLowerCase() : null,
      htmlAttrs: p.html ? attrText(attrsOf(p.html, true).map(a => [a.name, a.value == null ? '' : a.value])) : '',
      title: title ? htmlTrim(textOf(title, true)) : null,
      metas: metas.sort().join('\n'),
      head: { t: 'head', block: true, k: 'HEAD', c: head },
      bodyAttrs: p.body ? attrText(attrsOf(p.body, true).map(a => [a.name, a.value == null ? '' : a.value])) : '',
      body: { t: 'body', block: true, k: null, c: list(p.body, p.bodyItems, null, {}, 'body') },
      found,
    };
  }

  /* ================================================================== */
  /* C++ and Arduino                                                     */
  /* ================================================================== */

  const CPP_OPS = { '==': 'is', '!=': 'is not', '&&': 'and', '||': 'or', '+': 'plus', '-': 'minus', '*': 'times', '/': 'divided by', '%': 'mod', '>': 'is greater than', '<': 'is less than', '>=': 'is at least', '<=': 'is at most' };
  const TYPE_WORD = { int: 'whole number', double: 'decimal', bool: 'yes/no', char: 'character', void: 'nothing', 'std::string': 'text', string: 'text', String: 'text',
    'std::vector<int>': 'list of whole numbers', 'vector<int>': 'list of whole numbers', 'std::vector<double>': 'list of decimals', 'vector<double>': 'list of decimals', 'std::vector<std::string>': 'list of text', 'vector<string>': 'list of text' };

  function cppConvert(src, env, force, arduino) {
    const tree = env.parse('cpp', src);
    const o = Out();
    const CPP = env.CPP;
    const typeWord = (t) => {
      const s = collapse(t).replace(/\s*([&*])/g, '$1');
      if (TYPE_WORD[s] && !(arduino && s === 'std::string')) return TYPE_WORD[s];
      return CPP.typeOf(s, arduino) || classes.has(s) ? s : null;
    };
    /* "a whole number", "an Item"; text, nothing and yes/no go without */
    const art = (w) => (/^(?:text|nothing|yes\/no|words|read-only|the caller's)\b/.test(w) ? w : (/^(?:[aeio]|u(?!int|ni|s))/i.test(w) ? 'an ' : 'a ') + w);
    /* What a list holds, as the writer reads it after "list of" */
    const LIST_WORD = { int: 'whole numbers', double: 'decimals', 'std::string': 'text', string: 'text', String: 'text', char: 'characters', bool: 'yes/no values' };
    const listOf = (t) => { const s = collapse(t); if (LIST_WORD[s] && !(arduino && s === 'std::string')) return LIST_WORD[s]; const w = typeWord(s); return w && w === s && !/[&*]/.test(s) ? `${s} values` : null; };
    const classes = new Set();
    const cchain = (n) => n && (n.type === 'identifier' || n.type === 'field_identifier' || n.type === 'this' || n.type === 'qualified_identifier' || (n.type === 'field_expression' && cchain(F(n, 'argument'))));
    // the type each name is made with in this file (for "turn servo arm to 90 degrees", which only a Servo can do)
    const objType = new Map();
    (function scan(n) {
      if (n.type === 'declaration' && F(n, 'type')) for (const d of named(n)) { const id = d.type === 'identifier' ? d : d.type === 'init_declarator' && F(d, 'declarator').type === 'identifier' ? F(d, 'declarator') : null; if (id) objType.set(id.text, collapse(F(n, 'type').text)); }
      for (const c of named(n)) scan(c);
    })(tree);
    // every class and structure the file defines, said or kept as code (the writer learns them from c++: lines too)
    (function scan(n) {
      if ((n.type === 'class_specifier' || n.type === 'struct_specifier') && F(n, 'name') && F(n, 'body')) classes.add(F(n, 'name').text);
      for (const c of named(n)) scan(c);
    })(tree);
    const usingStd = named(tree).some(x => x.type === 'using_declaration' && collapse(x.text) === 'using namespace std;');
    /* The writer's own helpers (random_number, text), exactly as it writes them and where it puts them (first, after
       the includes): left out, since the sentences that need them ("random number from 1 to 6", "Hi {name}") bring
       them back. One that is kept as code turns those sentences off, so it isn't made twice. */
    const helpers = {};
    if (!arduino && CPP.HELPERS) {
      let order = ['random', 'text'];
      for (const n of named(tree)) {
        if (isComment(n) || n.type === 'preproc_include' || n.type === 'using_declaration') continue;
        const k = order.find(h => collapse(n.text) === collapse(CPP.HELPERS[h].join('\n')));
        if (!k || force.has(n.startIndex) || force.has('ALL')) break;
        helpers[k] = n.startIndex;
        order = order.slice(order.indexOf(k) + 1);
      }
    }
    let curFn = null;   // the function being said ("loop" for "over and over")
    /* A value that the writer reads as one operand (a name, a number, a call, a text…), so a phrase can be built round it */
    const OPD_RE = /^(?:-?\d+(?:\.\d+)?|'(?:[^'\\]|\\.)'|"(?:[^"\\]|\\.)*"|[A-Za-z_]\w*(?:(?:\.|->|::)[A-Za-z_]\w*|\((?:[^()"]|"(?:[^"\\]|\\.)*"|\((?:[^()"]|"(?:[^"\\]|\\.)*")*\))*\)|\[[^[\]]*\])*)$/;
    const opd = (s) => s != null && (OPD_RE.test(s) || (arduino && (s === 'the built-in light' || /^(?:reading of pin|how long pin) [A-Za-z_\d][\w.]*(?: stays (?:on|off))?$/.test(s))));
    const bare = (s) => String(s).replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, '""');
    const isCall = (n, name, count) => n && n.type === 'call_expression' && F(n, 'function').text === name && (count == null || named(F(n, 'arguments')).filter(x => !isComment(x)).length === count);
    const argsOf = (n) => named(F(n, 'arguments')).filter(x => !isComment(x));
    const unparen = (n) => { while (n && n.type === 'parenthesized_expression' && named(n).length === 1) n = named(n)[0]; return n; };
    const PASSED = { '>=': 'at least', '>': 'more than', '<': 'less than', '<=': 'at most' };
    function ex(n) {
      if (!n) return null;
      switch (n.type) {
        case 'identifier': return arduino && n.text === 'LED_BUILTIN' ? 'the built-in light' : n.text;
        case 'number_literal': case 'true': case 'false': case 'char_literal': case 'qualified_identifier': case 'field_identifier': case 'null': case 'nullptr': return n.text;
        case 'this': return 'this';
        case 'string_literal': return /\{\{|\}\}|\{[^{}]+\}/.test(n.text) || n.text.includes('\n') ? null : n.text;   // the translator fills in {x}
        case 'parenthesized_expression': { const e = ex(named(n)[0]); return e == null ? null : `(${e})`; }
        case 'binary_expression': {
          const op = F(n, 'operator').type, L = F(n, 'left'), R = F(n, 'right');
          if (arduino && op === '==' && L.type === 'call_expression' && F(L, 'function').text === 'digitalRead' && /^(HIGH|LOW)$/.test(R.text)) { const p = ex(named(F(L, 'arguments'))[0]); return p == null ? null : `pin ${p} is ${R.text === 'HIGH' ? 'on' : 'off'}`; }
          // millis() - last >= 500: "at least 500 milliseconds have passed since last"
          const LL = unparen(L);
          if (arduino && PASSED[op] && LL.type === 'binary_expression' && F(LL, 'operator').type === '-' && isCall(F(LL, 'left'), 'millis', 0)) {
            const since = ex(F(LL, 'right')), ms = ex(R);
            if (opd(since) && opd(ms) && since !== 'the built-in light') return `${PASSED[op]} ${ms} ${ms === '1' ? 'millisecond has' : 'milliseconds have'} passed since ${since}`;
          }
          // text joined with +: "Blinks: {blinks}" (Arduino's String("Blinks: ") + blinks)
          if (arduino && op === '+') { const t = textJoin(n); if (t != null) return t; }
          let l = ex(L), r = ex(R);
          if (l == null || r == null) return null;
          // "random number from 1 to 6 plus 1" could mean two things: brackets say which
          if (/^random number from /.test(l) && L.type === 'call_expression') l = `(${l})`;
          if (/^random number from /.test(r) && R.type === 'call_expression') r = `(${r})`;
          // "a plus b as text" could be (a plus b) as text: brackets round the value it goes with
          if (/^[-+*/%]$/.test(op) && / as (?:text|a decimal|a whole number)$/.test(r) && (R.type === 'call_expression' || R.type === 'cast_expression') && !(op === '+' && / as text$/.test(r) && plainLit(L))) r = `(${r})`;
          return `${l} ${CPP_OPS[op] || op} ${r}`;
        }
        case 'unary_expression': { const op = F(n, 'operator').type, a = ex(F(n, 'argument')); return a == null ? null : op === '!' ? `not ${a}` : `${op}${a}`; }
        case 'field_expression': {
          const arg = F(n, 'argument');
          if (arg.type === 'this' && n.text.includes('->')) return `self.${F(n, 'field').text}`;
          // tree-sitter reads item.count < LIMIT (with no > after it) as the start of a template: it is a comparison
          const fld = F(n, 'field');
          if (fld && fld.type === 'template_method' && cchain(arg) && !n.text.includes('>')) {
            const m = n.text.match(/^([A-Za-z_][\w.]*)\s*<\s*([A-Za-z_]\w*|-?\d+(?:\.\d+)?)$/);
            if (m) return `${m[1]} is less than ${m[2]}`;
          }
          if (cchain(n)) return n.text;
          // lights[i].pin
          return arg.type === 'subscript_expression' && /^[A-Za-z_]\w*\[[\w.]+\](?:\.[A-Za-z_]\w*)+$/.test(n.text) ? n.text : null;
        }
        case 'call_expression': {
          const fn = F(n, 'function');
          const a = argsOf(n);
          const args = a.map(ex);
          if (args.some(x => x == null)) return null;
          const f = fn.text;
          if (!arduino && fn.type === 'field_expression' && F(fn, 'field').text === 'size' && !a.length && cchain(F(fn, 'argument')) && F(fn, 'argument').type !== 'this') return `length of ${F(fn, 'argument').text}`;
          if (arduino && f === 'analogRead' && args.length === 1) return `reading of pin ${args[0]}`;
          if (arduino && f === 'millis' && !args.length) return 'time since start';
          if (arduino && f === 'pulseIn' && args.length === 2 && /^(HIGH|LOW)$/.test(args[1]) && opd(args[0])) return `how long pin ${args[0]} stays ${args[1] === 'HIGH' ? 'on' : 'off'}`;
          if (arduino && f === 'map' && args.length === 5 && args.every(opd)) return `${args[0]} scaled from ${args[1]}–${args[2]} to ${args[3]}–${args[4]}`;
          if (((arduino && f === 'constrain') || (!arduino && f === 'std::clamp')) && args.length === 3 && args.every(opd)) return `${args[0]} limited to ${args[1]}–${args[2]}`;
          if (arduino && f === 'random' && args.length === 2 && /^\d+$/.test(args[1]) && +args[1] > 0 && opd(args[0])) return `random number from ${args[0]} to ${+args[1] - 1}`;
          if (helpers.random && f === 'random_number' && args.length === 2 && args.every(opd)) return `random number from ${args[0]} to ${args[1]}`;
          // F("Ready"): text the board keeps in flash memory, so it takes none of the small working memory
          if (arduino && f === 'F' && a.length === 1 && plainLit(a[0])) return `${a[0].text} kept in flash`;
          // the writer's text helper: text("Hi ", name) is "Hi {name}"
          if (helpers.text && f === 'text' && a.length) { const t = fillText(a.map(textPiece)); if (t != null) return t; }
          // a value as another kind: "t as text", "reading as a decimal" (String(t), std::to_string, static_cast, toInt…)
          if (args.length === 1 && opd(args[0]) && args[0] !== 'the built-in light') {
            if (arduino ? f === 'String' : f === 'std::to_string' || (usingStd && f === 'to_string')) return `${args[0]} as text`;
            const cast = !arduino && fn.type === 'template_function' && collapse(fn.text).match(/^static_cast\s*<\s*(int|double)\s*>$/);
            if (cast) return `${args[0]} as ${cast[1] === 'int' ? 'a whole number' : 'a decimal'}`;
            if (!arduino && (/^std::sto[id]$/.test(f) || (usingStd && /^sto[id]$/.test(f)))) return `${args[0]} as ${/i$/.test(f) ? 'a whole number' : 'a decimal'}`;
          }
          // std::sqrt(x), std::abs(x) (sqrt, abs on a board): "square root of x", "absolute value of (a minus b)"
          const mf = arduino ? f : /^std::/.test(f) ? f.slice(5) : usingStd ? f : null, maths = args.length === 1 && mf && mf.match(/^(sqrt|abs)$/);
          if (maths && args[0] !== 'the built-in light') return `${maths[1] === 'sqrt' ? 'square root' : 'absolute value'} of ${opd(args[0]) ? args[0] : `(${args[0]})`}`;
          if (arduino && fn.type === 'field_expression' && !a.length && cchain(F(fn, 'argument')) && F(fn, 'argument').type !== 'this' && !fn.text.includes('->')) {
            const on = F(fn, 'argument').text, m = F(fn, 'field').text;
            if (m === 'toInt' || m === 'toFloat') return `${on} as ${m === 'toInt' ? 'a whole number' : 'a decimal'}`;
            if (m === 'length') return `length of ${on}`;
          }
          if (!cchain(fn)) return null;
          // a tool's result: "if not the result of bob.passed"; with inputs, in brackets that say where they end:
          // "(the result of a.at with i, k) times 2" (a whole value goes without them: see whole)
          const name = fn.type === 'field_expression' && F(fn, 'argument').type === 'this' ? (fn.text.includes('->') ? 'self.' + F(fn, 'field').text : null) : f;
          if (name && !classes.has(f) && /^(?:self\.)?[A-Za-z_]\w*(?:(?:\.|->|::)[A-Za-z_]\w*)*$/.test(name)) {
            if (!a.length) return `the result of ${name}`;
            if (!args.some(x => /\b(?:and|with)\b|,/.test(outside(x)))) return `(the result of ${name} with ${args.join(', ')})`;
          }
          return `${f}(${args.join(', ')})`;
        }
        // Arduino's (int)t: "t as a whole number" ((double)t: "as a decimal")
        case 'cast_expression': {
          const t = collapse(F(n, 'type') ? F(n, 'type').text : ''), v = ex(F(n, 'value'));
          if (arduino && /^(?:int|double)$/.test(t) && opd(v) && v !== 'the built-in light') return `${v} as ${t === 'int' ? 'a whole number' : 'a decimal'}`;
          return n.text.includes('\n') ? null : n.text;
        }
        case 'subscript_expression': {
          // history[i]: "item i of history"
          const list = F(n, 'argument'), idx = named(n).filter(x => x.type === 'subscript_argument_list').flatMap(named).filter(x => !isComment(x));
          if (idx.length === 1 && list && (list.type === 'identifier' || (list.type === 'field_expression' && cchain(list) && !list.text.includes('->')))) {
            const k = ex(idx[0]);
            if (k != null && opd(k) && k !== 'the built-in light') return `item ${k} of ${list.text}`;
          }
          return n.text.includes('\n') ? null : n.text;
        }
        default: return n.text.includes('\n') ? null : n.text;
      }
    }
    /* Text with values in it, as the writer reads "Hi {name}!": pieces of text ({ lit: '"Hi "' }) and values
       ({ v: 'name' }). Null if it can't be said that way: no value, two pieces of text in a row (they would be
       one), or a value with quotes or braces in it. Braces in the text are written twice. */
    function fillText(parts) {
      if (!parts.some(p => p.lit == null)) return null;
      let s = '';
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        if (p.lit != null) { if (i && parts[i - 1].lit != null) return null; s += p.lit.slice(1, -1).replace(/[{}]/g, c => c + c); }
        else { if (p.v == null || /["{}\n]/.test(p.v)) return null; s += `{${p.v}}`; }
      }
      return `"${s}"`;
    }
    const plainLit = (e) => e && e.type === 'string_literal' && /^"/.test(e.text) && !e.text.includes('\n');
    const textPiece = (e) => (plainLit(e) ? { lit: e.text } : { v: ex(e) });
    /* Arduino text joined with +, as the writer makes "…{x}…": String(first) + the rest ("{t} C" is String(t) + " C"),
       or text, then a String(…) already ("Temp: {t as text}" is "Temp: " + String(t)). */
    function textJoin(n) {
      const flat = [];
      const walk = (e) => { if (e.type === 'binary_expression' && F(e, 'operator').type === '+') { walk(F(e, 'left')); flat.push(F(e, 'right')); } else flat.push(e); };
      walk(n);
      const strCall = (e) => e && e.type === 'call_expression' && F(e, 'function').text === 'String' && argsOf(e).length === 1;
      if (strCall(flat[0])) {
        const first = argsOf(flat[0])[0];
        if (plainLit(first) && strCall(flat[1])) return null;   // the writer leaves String( ) off this text: another sentence
        return fillText([first, ...flat.slice(1)].map(textPiece));
      }
      if (plainLit(flat[0]) && strCall(flat[1])) {
        const v = ex(argsOf(flat[1])[0]);
        if (!opd(v) || v === 'the built-in light') return null;
        return fillText([{ lit: flat[0].text }, { v: `${v} as text` }, ...flat.slice(2).map(textPiece)]);
      }
      return null;
    }
    /* A whole value (what "set … to", "give back", "show" and "increase … by" are given): a tool's result needs no
       brackets there, "the result of average with scores", as the writer reads "with …" to the end of the value.
       In a list of values (list), the brackets keep each result's inputs together. */
    function whole(n, list) {
      const e = ex(n);
      return e != null && !list && n.type === 'call_expression' && /^\(the result of .+\)$/.test(e) ? e.slice(1, -1) : e;
    }
    // the text outside quotes and brackets (where a comma or "and" would split a list)
    const outside = (s) => { let t = bare(s); for (let u; (u = t.replace(/\([^()]*\)/g, '')) !== t;) t = u; return t; };
    const bodyOf = (n) => (n.type === 'compound_statement' ? named(n) : [n]);
    const block = (nodes, depth, key) => walkBlock(o, nodes, depth, key, force, 'c++:', src, stmt);
    const params = (fnDecl) => {
      const out = [];
      for (const p of named(F(fnDecl, 'parameters'))) {
        if (isComment(p)) continue;
        if (p.type !== 'parameter_declaration') return null;
        const d = F(p, 'declarator');
        if (!d) return null;
        let name = d;
        if (d.type === 'reference_declarator' || d.type === 'pointer_declarator') name = named(d).find(x => x.type === 'identifier');
        if (!name || name.type !== 'identifier') return null;
        const typeText = collapse(src.slice(p.startIndex, name.startIndex)).replace(/\s*([&*])/g, '$1');
        // const T& is a read-only reference, T& the caller's own value
        const ref = typeText.match(/^(const\s+)?(.+?)&$/);
        const inner = ref && !/[&*]$/.test(ref[2]) ? typeWord(ref[2]) : null;
        const w = inner ? (ref[1] ? 'read-only ' : "the caller's ") + inner : typeWord(typeText);
        if (!w) return null;
        out.push(`${w} ${name.text}`);
      }
      return out;
    };
    const isMain = (n) => n.type === 'function_definition' && /^main$/.test((F(F(n, 'declarator'), 'declarator') || {}).text || '');

    /* std::cout << a << b << std::endl  ->  "show a followed by b"; without std::endl, "… without ending the line" */
    function coutParts(e) {
      const flat = [];
      const walk = (n) => { if (n.type === 'binary_expression' && F(n, 'operator').type === '<<') { walk(F(n, 'left')); flat.push(F(n, 'right')); } else flat.push(n); };
      walk(e);
      if (!/^(std::)?cout$/.test(flat[0].text)) return null;
      let items = flat.slice(1), end = 'none';
      if (items.length && /^(std::)?endl$/.test(items[items.length - 1].text)) { end = 'endl'; items = items.slice(0, -1); }
      else if (items.length > 1 && items[items.length - 1].text === '" "') { end = 'space'; items = items.slice(0, -1); }
      else if (items.length > 1 && items[items.length - 1].text === '"\\n"') { end = 'nl'; items = items.slice(0, -1); }
      if (!items.length) return end === 'endl' ? 'end the line' : null;
      if (items.some(x => /^(std::)?endl$/.test(x.text))) return null;
      const spaced = items.length >= 3 && items.length % 2 === 1 && items.every((x, i) => (i % 2 === 1 ? x.text === '" "' : x.text !== '" "'));
      const pieces = (spaced ? items.filter((x, i) => i % 2 === 0) : items).map(x => (spaced ? ex(x) : whole(x)));
      if (pieces.some(x => x == null)) return null;
      if (!spaced && pieces.length > 1 && pieces.some(p => / followed by /.test(bare(p)))) return null;
      return `show ${spaced || pieces.length === 1 ? pieces.join(' and ') : pieces.join(' followed by ')}${end === 'space' ? ' on the same line' : end === 'none' ? ' without ending the line' : end === 'nl' ? ', then start a new line' : ''}`;
    }
    /* std::cin >> a >> b  ->  "read a and b from the keyboard" */
    function cinParts(e) {
      const flat = [];
      const walk = (n) => { if (n.type === 'binary_expression' && F(n, 'operator').type === '>>') { walk(F(n, 'left')); flat.push(F(n, 'right')); } else flat.push(n); };
      walk(e);
      if (arduino || !/^(std::)?cin$/.test(flat[0].text) || flat.length < 2) return null;
      const names = flat.slice(1);
      if (!names.every(cchain)) return null;
      return `read ${names.map(x => (x.type === 'field_expression' && F(x, 'argument').type === 'this' ? 'self.' + F(x, 'field').text : x.text)).join(' and ')} from the keyboard`;
    }
    /* Serial.print(a); Serial.print(b); Serial.println(c);  ->  one "show a followed by b followed by c" */
    const consumed = new Set();
    const serialPrint = (n) => {
      if (!n || n.type !== 'expression_statement') return null;
      const e = named(n)[0];
      if (!e || e.type !== 'call_expression' || !/^Serial\.print(?:ln)?$/.test(F(e, 'function').text)) return null;
      const a = argsOf(e);
      return a.length === 1 ? { ln: F(e, 'function').text === 'Serial.println', v: whole(a[0]) } : a.length === 2 ? { ln: F(e, 'function').text === 'Serial.println', v: printAs(a[0], a[1]) } : null;
    };
    /* print(t, 2) on Arduino: a decimal with 2 decimal places; print(n, HEX): a whole number in hexadecimal */
    function printAs(v, how) {
      const e = ex(v), BASE = { HEX: 'hexadecimal', BIN: 'binary', OCT: 'octal' };
      if (e == null || / with \d+ decimal places?$| in (?:hexadecimal|binary|octal)$/.test(e)) return null;
      if (BASE[how.text]) return `${e} in ${BASE[how.text]}`;
      const t = v.type === 'identifier' ? objType.get(v.text) : v.type === 'number_literal' && /\./.test(v.text) ? 'double' : null;
      return /^\d+$/.test(how.text) && /^(?:float|double)$/.test(t || '') ? `${e} with ${how.text} decimal place${how.text === '1' ? '' : 's'}` : null;
    }
    function serialRun(n) {
      const first = serialPrint(n);
      if (!first || first.ln || first.v == null) return null;
      const run = [{ node: n, ...first }];
      for (let nx = n.nextNamedSibling, row = n.endPosition.row; nx && !force.has(nx.startIndex) && nx.startPosition.row <= row + 1; nx = nx.nextNamedSibling) {
        const p = serialPrint(nx);
        if (!p || p.v == null) break;
        run.push({ node: nx, ...p });
        row = nx.endPosition.row;
        if (p.ln) break;
      }
      if (run.length < 2) return null;
      const items = run.map(r => r.v), ends = run[run.length - 1].ln;
      const spaced = items.length >= 3 && items.length % 2 === 1 && items.every((v, i) => (i % 2 ? v === '" "' : v !== '" "'));
      const pieces = spaced ? items.filter((v, i) => i % 2 === 0) : items;
      if (spaced ? pieces.some(p => /\band\b|,/.test(bare(p))) : pieces.some(p => / followed by /.test(bare(p)))) return null;
      run.slice(1).forEach(r => consumed.add(r.node.startIndex));
      return `show ${pieces.join(spaced ? ' and ' : ' followed by ')}${ends ? '' : ' on the same line'}`;
    }
    // words that would split a "scale …" or "keep … between … and …" sentence somewhere else
    const splits = (s) => /[–—]|\b(?:to|from|and)\b/.test(bare(s));

    function exprStmt(e, depth, node) {
      const say = (t) => { o.say(depth, t); return true; };
      if (e.type === 'binary_expression' && F(e, 'operator').type === '<<') { const s = coutParts(e); return !arduino && s != null && say(s); }
      if (e.type === 'binary_expression' && F(e, 'operator').type === '>>') { const s = cinParts(e); return s != null && say(s); }
      if (e.type === 'assignment_expression') {
        const op = F(e, 'operator').type, L = F(e, 'left'), R = F(e, 'right');
        // one item of a list: "set item i of readings to t"
        if (op === '=' && L.type === 'subscript_expression' && F(L, 'argument').type === 'identifier') {
          const idx = named(L).filter(x => x.type === 'subscript_argument_list').flatMap(named).filter(x => !isComment(x));
          const k = idx.length === 1 ? ex(idx[0]) : null, val = whole(R);
          if (k != null && val != null && !/\b(?:of|in)\b/.test(bare(k))) return say(`set item ${k} of ${F(L, 'argument').text} to ${val}`);
        }
        const target = L.type === 'field_expression' && F(L, 'argument').type === 'this' && L.text.includes('->') ? `self.${F(L, 'field').text}` : L.type === 'identifier' || cchain(L) || L.type === 'subscript_expression' ? L.text : null;
        if (!target || target.includes('\n')) return false;
        if (op === '=' && L.type === 'identifier') {
          // level = analogRead(A0): "read pin A0 and store it in level"
          if (arduino && (isCall(R, 'analogRead', 1) || isCall(R, 'digitalRead', 1))) {
            const p = ex(argsOf(R)[0]);
            if (p != null) return say(`read ${readKind(F(R, 'function').text, p)}pin ${p} and store it in ${target}`);
          }
          // level = map(reading, 0, 1023, 0, 255): "scale reading from 0–1023 to 0–255 and store it in level"
          if (arduino && isCall(R, 'map', 5)) {
            const a = argsOf(R).map(ex);
            if (!a.some(x => x == null || splits(x))) return say(`scale ${a[0]} from ${a[1]}–${a[2]} to ${a[3]}–${a[4]} and store it in ${target}`);
          }
          // level = constrain(level, 0, 255): "keep level between 0 and 255"
          if (isCall(R, arduino ? 'constrain' : 'std::clamp', 3) && argsOf(R)[0].text === target) {
            const a = argsOf(R).map(ex);
            if (!a.some(x => x == null || /\band\b/.test(bare(x)))) return say(`keep ${target} between ${a[1]} and ${a[2]}`);
          }
        }
        const v = whole(R);
        if (v == null) return false;
        if (op === '=') return say(`set ${target} to ${v}`);
        if (op === '+=') return say(`increase ${target} by ${v}`);
        if (op === '-=') return say(`decrease ${target} by ${v}`);
        if (op === '*=') return say(`multiply ${target} by ${v}`);
        if (op === '/=') return say(`divide ${target} by ${v}`);
        return false;
      }
      // x++ only: ++x can be a different operator in a class (or the only one it has)
      if (e.type === 'update_expression') { const a = F(e, 'argument'); return cchain(a) && !/^(\+\+|--)$/.test(kids(e)[0].type) && say(`${e.text.includes('++') ? 'increase' : 'decrease'} ${a.text}`); }
      if (e.type === 'call_expression') {
        const fn = F(e, 'function'), a = argsOf(e);
        const f = fn.text;
        // printf("%d tries\n", tries): "show "%d tries\n" filled in with tries" (the text is kept as it is)
        if ((arduino ? f === 'Serial.printf' : f === 'printf') && a.length >= 2 && a[0].type === 'string_literal' && !a[0].text.includes('\n')) {
          const rest = a.slice(1).map(ex);
          if (!rest.some(x => x == null)) return say(`show ${a[0].text} filled in with ${rest.join(', ')}`);
        }
        const v = a.map(x => whole(x, true));
        if (v.some(x => x == null)) return false;
        const one = a.length === 1 ? whole(a[0]) : null;   // the only value: a tool's result can have its inputs
        if (!arduino && /^(?:std::)?getline$/.test(f) && v.length === 2 && /^(std::)?cin$/.test(a[0].text) && cchain(a[1])) return say(`read a line from the keyboard into ${v[1]}`);
        if (arduino) {
          const pin = (x) => (x === 'the built-in light' ? x : `pin ${x}`);
          if (f === 'pinMode' && v.length === 2) { const m = { OUTPUT: 'an output', INPUT: 'an input', INPUT_PULLUP: 'an input with pull-up' }[v[1]]; return !!m && say(`make ${pin(v[0])} ${m}`); }
          if (f === 'digitalWrite' && v.length === 2 && /^(HIGH|LOW)$/.test(v[1])) return say(v[0] === 'the built-in light' ? `turn ${v[1] === 'HIGH' ? 'on' : 'off'} the built-in light` : `turn pin ${v[0]} ${v[1] === 'HIGH' ? 'on' : 'off'}`);
          if (f === 'digitalWrite' && v.length === 2 && a[1].type === 'conditional_expression') {
            // digitalWrite(fan, on ? HIGH : LOW): "turn pin fan on if on, otherwise off"
            const c = ex(F(a[1], 'condition')), yes = F(a[1], 'consequence').text, no = F(a[1], 'alternative').text;
            if (c != null && /^(HIGH|LOW)$/.test(yes) && /^(HIGH|LOW)$/.test(no) && yes !== no && !/,|\botherwise\b/.test(bare(c))) return say(`turn ${pin(v[0])} ${yes === 'HIGH' ? 'on' : 'off'} if ${c}, otherwise ${no === 'HIGH' ? 'on' : 'off'}`);
          }
          if (f === 'digitalWrite' && v.length === 2) return say(`set ${pin(v[0])} to ${v[1]}`);
          if (f === 'analogWrite' && v.length === 2) return say(`set the brightness of ${pin(v[0])} to ${v[1]}`);
          if (f === 'delay' && v.length === 1) return say(`wait ${v[0]} milliseconds`);
          if (f === 'delayMicroseconds' && v.length === 1) return say(`wait ${v[0]} microseconds`);
          if (f === 'Serial.begin' && v.length === 1 && /^\d+$/.test(v[0])) return say(`start the serial monitor at ${v[0]}`);
          if (f === 'Serial.println' && !v.length) return say('end the line');
          const shown = v.length === 1 ? one : v.length === 2 ? printAs(a[0], a[1]) : null;
          if (f === 'Serial.print' && shown != null) { const run = serialRun(node); if (run) return say(run); }
          if ((f === 'Serial.println' || f === 'Serial.print') && shown != null) return say(`show ${shown}${f === 'Serial.print' ? ' on the same line' : ''}`);
          if (f === 'tone' && (v.length === 2 || v.length === 3)) return say(`play a tone of ${v[1]} on ${pin(v[0])}${v[2] ? ` for ${v[2]} milliseconds` : ''}`);
          if (f === 'noTone' && v.length === 1) return say(`stop the tone on ${pin(v[0])}`);
        }
        // an object's own steps, said for what they do: lcd.print(x), lcd.setCursor(0, 1), servo.write(90)…
        if (fn.type === 'field_expression' && F(fn, 'argument').type === 'identifier' && !fn.text.includes('->')) {
          const obj = F(fn, 'argument').text, meth = F(fn, 'field').text;
          const shown = v.length === 1 ? one : arduino && v.length === 2 ? printAs(a[0], a[1]) : null;
          if (obj !== 'Serial' && (meth === 'print' || meth === 'println') && shown != null && (/^the result of /.test(shown) || !/\band\b|,/.test(bare(shown)))) return say(`show ${shown} on ${obj}${meth === 'println' ? ', then start a new line' : ''}`);
          if (meth === 'setCursor' && v.length === 2 && !v.some(x => /,/.test(bare(x)))) return say(`move ${obj}'s cursor to ${v[0]}, ${v[1]}`);
          if (meth === 'clear' && !v.length) return say(`clear ${obj}`);
          if (meth === 'begin' && obj !== 'Serial' && !/^(?:the|talking)$/.test(obj)) return say(`start ${obj}${v.length ? ' with ' + v.join(', ') : ''}`);
          if (arduino && meth === 'attach' && v.length === 1) return say(`attach ${obj} to pin ${v[0]}`);
          if (arduino && meth === 'write' && v.length === 1 && objType.get(obj) === 'Servo') return say(`turn servo ${obj} to ${v[0]} degrees`);
        }
        if (fn.type === 'field_expression' && F(fn, 'field').text === 'push_back' && v.length === 1 && F(fn, 'argument').type === 'identifier' && !arduino) return say(`add ${v[0]} to ${F(fn, 'argument').text}`);
        // std::sort(xs.begin(), xs.end()): "sort xs"; with std::greater<>() as well, "sort xs biggest first"
        if (!arduino && (f === 'std::sort' || (usingStd && f === 'sort')) && (a.length === 2 || a.length === 3)) {
          const end = (c, which) => c.type === 'call_expression' && !argsOf(c).length && F(c, 'function').type === 'field_expression' && F(F(c, 'function'), 'field').text === which ? F(F(c, 'function'), 'argument') : null;
          const b = end(a[0], 'begin'), e2 = end(a[1], 'end');
          const down = a.length === 3 && collapse(a[2].text).replace(/\s+/g, '') === (usingStd && !/^std::/.test(a[2].text) ? 'greater<>()' : 'std::greater<>()');
          if (b && e2 && b.text === e2.text && cchain(b) && b.type !== 'this' && !b.text.includes('->') && (a.length === 2 || down)) return say(`sort ${b.text}${down ? ' biggest first' : ''}`);
        }
        if (cchain(fn) && fn.type !== 'qualified_identifier') return say(`run ${fn.type === 'field_expression' && F(fn, 'argument').type === 'this' ? 'self.' + F(fn, 'field').text : f}${v.length ? ' with ' + v.join(', ') : ''}`);
        return false;
      }
      return false;
    }
    // "read pin A0", "read analog pin SENSOR", "read digital pin A1": the writer reads A0… as analog unless told
    const readKind = (f, p) => (f === 'analogRead' ? (/^A\d+$/.test(p) ? '' : 'analog ') : /^A\d+$/.test(p) ? 'digital ' : '');

    function stmt(n, depth, lvl = 0) {
      const say = (t) => { o.say(depth, t); return true; };
      if (consumed.has(n.startIndex)) return true;   // said with the statement before it
      if (lvl && n.type !== 'declaration') return false;
      switch (n.type) {
        case 'expression_statement': { const e = named(n)[0]; return !!e && exprStmt(e, depth, n); }
        case 'declaration': {
          const ds = named(n).filter(x => x.type === 'init_declarator' || x.type === 'identifier' || x.type === 'array_declarator');
          const quals = kids(n).filter(x => x.type === 'type_qualifier' || x.type === 'storage_class_specifier').map(x => x.text);
          if (ds.length !== 1 || quals.some(q => q !== 'const') || quals.length > 1) return false;
          const d = ds[0];
          const type = collapse(F(n, 'type').text);
          // const int PINS[] = {2, 3}: "make a constant list of whole numbers called PINS with 2, 3" (said below)
          const fixedList = quals.length === 1 && !lvl && d.type === 'init_declarator' && F(d, 'value') && F(d, 'value').type === 'initializer_list';
          const list = fixedList ? 'constant list' : 'list';
          if ((quals.length || lvl) && !fixedList) {   // constant, or with its type spelled out
            if (d.type !== 'init_declarator' || F(d, 'declarator').type !== 'identifier' || !F(d, 'value') || F(d, 'value').type === 'initializer_list' || F(d, 'value').type === 'argument_list') return false;
            const w = typeWord(type), v = whole(F(d, 'value'));
            if (!w || w === 'nothing' || v == null) return false;
            o.careful.add(n.startIndex);
            if (quals.length) return say(lvl ? `constant ${w} ${F(d, 'declarator').text} is ${v}` : `constant ${F(d, 'declarator').text} is ${v}`);
            return say(`set ${w} ${F(d, 'declarator').text} to ${v}`);
          }
          o.careful.add(n.startIndex);
          const vm = type.match(/^(?:std::)?vector<\s*(.+?)\s*>$/);
          // made with no value: "make a whole number called count", "make empty text called name", "make a Servo called arm"
          if (d.type === 'identifier') {
            if (vm) { const w = !arduino && listOf(vm[1]); return !!w && say(`make an empty list of ${w} called ${d.text}`); }
            // a type word, or a class (one of this file's, or a library's like Servo, as the writer reads them)
            const w = typeWord(type) || (/^(?:[A-Z]\w*|[A-Za-z_]\w*(?:::[A-Za-z_]\w*)+)(?:<.+>)?$/.test(type) ? type : null);
            if (!w || w === 'nothing' || /^list of /.test(w) || /[&*]/.test(w)) return false;
            return say(w === 'text' ? `make empty text called ${d.text}` : `make ${art(w === 'yes/no' ? 'yes/no value' : w)} called ${d.text}`);
          }
          // a list of a fixed size: "make a list of 8 characters called label"
          const sized = (dd) => { const sz = named(dd).filter(x => !isComment(x))[1]; return sz ? (/^(?:\d+|[A-Z_][A-Z0-9_]*)$/.test(sz.text) ? sz.text : null) : ''; };
          if (d.type === 'array_declarator') {
            const nm = F(d, 'declarator'), size = sized(d), w = listOf(type);
            return nm.type === 'identifier' && !!size && !!w && say(`make a list of ${size} ${w} called ${nm.text}`);
          }
          const dd = F(d, 'declarator'), val = F(d, 'value');
          if (!val) return false;
          if (dd.type === 'array_declarator' && val.type === 'initializer_list') {
            const nm = F(dd, 'declarator'), size = sized(dd), w = listOf(type);
            const items = named(val).filter(x => !isComment(x)).map(ex);
            // without a size, only Arduino makes a plain array ("make a list of …" is a std::vector in C++)
            return nm.type === 'identifier' && size != null && (size || arduino) && !!w && items.length > 0 && !items.some(x => x == null) && say(`make a ${list} of ${size ? size + ' ' : ''}${w} called ${nm.text} with ${items.join(', ')}`);
          }
          if (dd.type !== 'identifier') return false;
          if (vm && val.type === 'initializer_list') {
            const items = named(val).filter(x => !isComment(x)).map(ex), w = !arduino && listOf(vm[1]);
            return !!w && items.length > 0 && !items.some(x => x == null) && say(`make a ${list} of ${w} called ${dd.text} with ${items.join(', ')}`);
          }
          if (fixedList) return false;
          if (val.type === 'argument_list') {
            const items = named(val).filter(x => !isComment(x)).map(x => whole(x, true));
            return /^[A-Z][\w]*$|::/.test(type) && items.length > 0 && !items.some(x => x == null) && say(`make ${art(type)} called ${dd.text} with ${items.join(', ')}`);
          }
          // int level = analogRead(A0): "read pin A0 and call it level (a whole number)"
          const tw = typeWord(type);
          if (arduino && tw && !/[&*]|^list of /.test(tw) && (isCall(val, 'analogRead', 1) || isCall(val, 'digitalRead', 1))) {
            const p = ex(argsOf(val)[0]);
            if (p != null) return say(`read ${readKind(F(val, 'function').text, p)}pin ${p} and call it ${dd.text} (${art(tw)})`);
          }
          if (arduino && tw && !/[&*]|^list of /.test(tw) && isCall(val, 'map', 5)) {
            const a = argsOf(val).map(ex);
            if (!a.some(x => x == null || splits(x))) return say(`scale ${a[0]} from ${a[1]}–${a[2]} to ${a[3]}–${a[4]} and call it ${dd.text} (${art(tw)})`);
          }
          const v = whole(val);
          return v != null && say(`set ${dd.text} to ${v}`);
        }
        case 'if_statement': {
          const cond = F(n, 'condition');
          const c = ex(cond.type === 'condition_clause' ? F(cond, 'value') : named(cond)[0]);
          if (c == null || (cond.type === 'condition_clause' && F(cond, 'initializer'))) return false;
          say(`if ${c}`);
          block(bodyOf(F(n, 'consequence')), depth + 1, n.startIndex);
          let alt = F(n, 'alternative');
          if (alt && alt.type === 'else_clause') alt = named(alt).find(x => !isComment(x));
          while (alt) {
            if (alt.type === 'if_statement') {
              const c2c = F(alt, 'condition');
              const c2 = ex(c2c.type === 'condition_clause' ? F(c2c, 'value') : named(c2c)[0]);
              if (c2 == null) return false;
              say(`otherwise if ${c2}`);
              o.parents.set(alt.startIndex, n.startIndex);
              block(bodyOf(F(alt, 'consequence')), depth + 1, n.startIndex);
              alt = F(alt, 'alternative');
              if (alt && alt.type === 'else_clause') alt = named(alt).find(x => !isComment(x));
            } else { say('otherwise'); block(bodyOf(alt), depth + 1, n.startIndex); alt = null; }
          }
          return true;
        }
        case 'while_statement': {
          const cond = F(n, 'condition');
          const c = ex(cond.type === 'condition_clause' ? F(cond, 'value') : named(cond)[0]);
          if (c == null) return false;
          say(c === 'true' ? 'repeat forever' : `while ${c}`);
          block(bodyOf(F(n, 'body')), depth + 1, n.startIndex);
          return true;
        }
        case 'do_statement': {
          const c = ex(unparen(F(n, 'condition')));
          if (c == null) return false;
          say(`do this, then repeat while ${c}`);
          block(bodyOf(F(n, 'body')), depth + 1, n.startIndex);
          return true;
        }
        case 'for_range_loop': {
          const right = F(n, 'right'), list = ex(right), d = F(n, 'declarator');
          const name = d && (d.type === 'identifier' ? d : named(d).find(x => x.type === 'identifier'));
          if (!name || list == null) return false;
          const head = collapse(src.slice(n.startIndex, right.startIndex));
          const typeText = collapse(src.slice(n.startIndex, name.startIndex).replace(/^for\s*\(/, '')).replace(/\s*([&*])/g, '$1');
          let how;
          if (/^for\s*\(\s*const auto\s*&\s*\w+\s*:$/.test(head)) how = '';
          else if (typeText === 'auto&') how = ', so it can be changed';
          else if (typeText === 'auto') how = ', as a copy';
          else {
            // a type said: "for each whole number v in values", "for each read-only text w in words", "…, so it can be changed"
            const ref = typeText.match(/^(const\s+)?(.+?)&$/);
            const inner = ref && !/[&*]$/.test(ref[2]) ? typeWord(ref[2]) : null;
            const w = inner ? (ref[1] ? 'read-only ' + inner : inner) : typeWord(typeText);
            if (!w || /[&*]/.test(w)) return false;
            how = `${w} `;
            say(`for each ${how}${name.text} in ${list}${inner && !ref[1] ? ', so it can be changed' : ''}`);
            block(bodyOf(F(n, 'body')), depth + 1, n.startIndex);
            return true;
          }
          say(`for each ${name.text} in ${list}${how}`);
          block(bodyOf(F(n, 'body')), depth + 1, n.startIndex);
          return true;
        }
        case 'for_statement': {
          const init = F(n, 'initializer'), cond = F(n, 'condition'), upd = F(n, 'update'), body = F(n, 'body');
          if (!init || !cond || !upd || !body) return false;
          // the count: "int v = a" makes it; "v = a" counts with a name made before
          let v, A, made;
          if (init.type === 'declaration') {
            const ids = named(init).filter(x => x.type === 'init_declarator');
            if (collapse(F(init, 'type').text) !== 'int' || ids.length !== 1 || kids(init).some(x => x.type === 'type_qualifier' || x.type === 'storage_class_specifier') || F(ids[0], 'declarator').type !== 'identifier') return false;
            v = F(ids[0], 'declarator').text; A = F(ids[0], 'value'); made = true;
          } else if (init.type === 'assignment_expression' && F(init, 'operator').type === '=' && F(init, 'left').type === 'identifier') {
            v = F(init, 'left').text; A = F(init, 'right'); made = false;
          } else return false;
          if (cond.type !== 'binary_expression' || F(cond, 'left').type !== 'identifier' || F(cond, 'left').text !== v) return false;
          const cop = F(cond, 'operator').type;
          let dir, step = null;
          const u = collapse(upd.text).replace(/\s+/g, '');
          if (upd.type === 'update_expression' && (u === v + '++' || (made && u === '++' + v))) dir = 1;   // (for an int, ++i and i++ are the same here)
          else if (upd.type === 'update_expression' && (u === v + '--' || (made && u === '--' + v))) dir = -1;
          else if (upd.type === 'assignment_expression' && F(upd, 'left').text === v && /^[+-]=$/.test(F(upd, 'operator').type)) { dir = F(upd, 'operator').type === '+=' ? 1 : -1; step = ex(F(upd, 'right')); if (step == null) return false; }
          else return false;
          const a = whole(A, true), b = whole(F(cond, 'right'), true);
          if (a == null || b == null) return false;
          const uses = new RegExp(`\\b${v}\\b`).test(body.text);
          const num = (t) => /^-?\d+$/.test(t);
          const steps = step ? ` in steps of ${step}` : '';
          if (cop === '<' && dir === 1 && a === '0' && !step) say(`repeat ${b} times${made && v === 'i' && !uses ? '' : ', counting with ' + v}`);
          else if (cop === '<' && dir === 1) say(`count ${v} from ${a} up to but not including ${b}${steps}`);
          else if ((cop === '<=' && dir === 1) || (cop === '>=' && dir === -1)) {
            const down = dir === -1;
            const way = down ? (num(a) && num(b) && +a > +b ? '' : 'down ') : (num(b) && !num(a)) || (num(a) && num(b) && +a > +b) ? 'up ' : '';
            say(`count ${down ? 'down ' : way}${v} from ${a} to ${b}${steps}`);
          } else return false;
          block(bodyOf(body), depth + 1, n.startIndex);
          return true;
        }
        case 'switch_statement': {
          const cond = F(n, 'condition');
          const c = ex(cond.type === 'condition_clause' ? F(cond, 'value') : named(cond)[0]);
          if (c == null || (cond.type === 'condition_clause' && F(cond, 'initializer'))) return false;
          const cases = named(F(n, 'body'));
          if (!cases.length || cases.some(x => x.type !== 'case_statement')) return false;
          // the cases and their values are compared as parts of the switch: a difference in one keeps it all as code
          const owned = cases.flatMap(cs => [cs.startIndex, ...(F(cs, 'value') ? [F(cs, 'value').startIndex] : [])]);
          if (owned.some(k => force.has(k))) return false;
          owned.forEach(k => o.parents.set(k, n.startIndex));
          const JUMP = /^(?:return_statement|break_statement|continue_statement|throw_statement|goto_statement)$/;
          const plan = [];
          let pending = [];
          for (let k = 0; k < cases.length; k++) {
            const cs = cases[k], val = F(cs, 'value'), last = k === cases.length - 1;
            const label = val ? ex(val) : null;
            if (val && (label == null || /\bor\b/.test(bare(label)))) return false;
            let body = named(cs).filter(x => !(val && x.startIndex === val.startIndex && x.type === val.type));
            if (!body.some(x => !isComment(x)) && !last) { if (!val || body.length) return false; pending.push(label); continue; }   // case 1: case 2: … is "when it is 1 or 2"
            if (!val && pending.length) return false;
            // a case in braces, with its break inside: case 1: { int x = …; break; }
            const real = () => body.filter(x => !isComment(x));
            if (real().length === 1 && real()[0].type === 'compound_statement') {
              body = named(real()[0]);
              const r = real();
              if (!r.length || r[r.length - 1].type !== 'break_statement') return false;
            }
            const r = real(), end = r[r.length - 1];
            let fall = false;
            if (end && end.type === 'break_statement') {
              if (r.length > 1 && JUMP.test(r[r.length - 2].type)) return false;   // break after give back: the writer adds none
              body = body.filter(x => x !== end);
            } else if (end && JUMP.test(end.type)) { /* it leaves by itself */ }
            else if (!last) fall = true;   // no break: C++ carries on into the next case
            plan.push({ head: val ? `when it is ${[...pending, label].join(' or ')}` : 'otherwise', body, fall });
            pending = [];
          }
          say(`depending on ${c}`);
          for (const p of plan) {
            o.say(depth + 1, p.head);
            block(p.body, depth + 2, n.startIndex);
            if (p.fall) o.say(depth + 2, 'go on into the next case');
          }
          return true;
        }
        case 'return_statement': {
          const v = named(n).filter(x => !isComment(x))[0];
          if (!v) return say(arduino && curFn === 'loop' ? 'skip the rest of this round' : curFn && curFn !== 'setup' ? 'leave the tool now' : 'give back');
          const e = whole(v);
          return e != null && say(`give back ${e}`);
        }
        case 'break_statement': return say('stop the loop');
        case 'continue_statement': return say('skip to next');
        // throw std::invalid_argument("…"): "fail with std::invalid_argument: "…"" (as in Python and JavaScript)
        case 'throw_statement': {
          const v = named(n).filter(x => !isComment(x))[0];
          if (arduino || !v || v.type !== 'call_expression' || !/^[A-Za-z_]\w*(?:::[A-Za-z_]\w*)*$/.test(F(v, 'function').text)) return false;
          const a = argsOf(v);
          if (a.length > 1) return false;
          const msg = a.length ? whole(a[0]) : '';
          return msg != null && say(`fail with ${F(v, 'function').text}${a.length ? ': ' + msg : ''}`);
        }
        default: return false;
      }
    }

    /* A tool's first line. In a class, int rows() const (it can't change the object) is "…, without changing the object". */
    function funcSentence(fn, inClass) {
      const d = F(fn, 'declarator');
      if (!d || d.type !== 'function_declarator') return null;
      const nameNode = F(d, 'declarator');
      if (!nameNode || !/^(identifier|field_identifier)$/.test(nameNode.type)) return null;
      const extra = named(d).filter(x => !isComment(x) && x.startIndex !== nameNode.startIndex && x.type !== 'parameter_list');
      if (extra.some(x => !(inClass && x.type === 'type_qualifier' && x.text === 'const')) || extra.length > 1) return null;
      const type = F(fn, 'type');
      if (!type || kids(fn).some(x => /storage_class_specifier|virtual|type_qualifier|attribute/.test(x.type))) return null;
      const ret = typeWord(type.text);
      const ps = params(d);
      if (!ret || !ps) return null;
      return `define ${nameNode.text}${ps.length ? ' using ' + ps.join(', ') : ''} giving back ${art(ret)}${extra.length ? ', without changing the object' : ''}`;
    }
    const fnName = (n) => { const d = F(n, 'declarator'); return d && F(d, 'declarator') ? F(d, 'declarator').text : ''; };
    const fnBody = (n, depth, key) => { const was = curFn; curFn = fnName(n); try { block(named(F(n, 'body')), depth, key); } finally { curFn = was; } };

    function top(n, depth, lvl = 0) {
      const say = (t) => { o.say(depth, t); return true; };
      if (lvl && n.type !== 'declaration') return false;
      if (Object.values(helpers).includes(n.startIndex)) return true;   // the sentences that use it make it again
      if (n.type === 'preproc_include') { const p = F(n, 'path'); return !!p && say(`include ${p.text}`); }
      if (n.type === 'using_declaration' && collapse(n.text) === 'using namespace std;') return say('use namespace std');
      // #define LED 13: "let LED stand for 13"
      if (n.type === 'preproc_def') {
        const nm = F(n, 'name'), v = F(n, 'value');
        return !!nm && !!v && /^(?:-?\d+(?:\.\d+)?|[A-Za-z_]\w*|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)')$/.test(v.text.trim()) && say(`let ${nm.text} stand for ${v.text.trim()}`);
      }
      if (n.type === 'function_definition') {
        const d = F(n, 'declarator');
        const name = fnName(n);
        const noParams = d && d.type === 'function_declarator' && !named(F(d, 'parameters')).some(x => !isComment(x) && x.text !== 'void');
        if (arduino && (name === 'setup' || name === 'loop') && noParams && F(n, 'type').text === 'void') {
          say(name === 'setup' ? 'when the board starts' : 'over and over');
          fnBody(n, depth + 1, n.startIndex);
          return true;
        }
        const s = funcSentence(n);
        if (!s) return false;
        say(s);
        fnBody(n, depth + 1, n.startIndex);
        return true;
      }
      if (n.type === 'class_specifier' || n.type === 'struct_specifier') {
        const struct = n.type === 'struct_specifier';
        const name = F(n, 'name'), body = F(n, 'body');
        if (!name || !body) return false;
        const base = named(n).find(x => x.type === 'base_class_clause');
        let baseName = null;
        if (base) { if (struct) return false; const t = collapse(base.text).replace(/^:\s*/, ''); const m = t.match(/^public ([A-Za-z_][\w:]*)$/); if (!m) return false; baseName = m[1]; }
        const items = named(body);
        const firstReal = items.find(x => !isComment(x));
        // a class starts with public: (said by "define class"), or with private: ("the rest is private" first)
        if (!struct && (!firstReal || firstReal.type !== 'access_specifier' || !/^(public|private)$/.test(firstReal.text))) return false;
        classes.add(name.text);
        say(struct ? `define structure ${name.text}` : `define class ${name.text}${baseName ? ' based on ' + baseName : ''}`);
        let seenFirst = struct, prevEnd = null;
        /* One member as a sentence (false: it can't be said, so it stays exact code inside the class) */
        const member = (it) => {
          if (it.type === 'access_specifier') {
            if (!/^(public|private)$/.test(it.text)) return false;
            if (!seenFirst) { seenFirst = true; if (it.text === 'public') return true; }
            o.say(depth + 1, `the rest is ${it.text}`); return true;
          }
          if (it.type === 'field_declaration') {
            const ds = named(it).filter(x => x.type === 'field_identifier');
            const dv = F(it, 'default_value');
            if (ds.length !== 1 || F(it, 'declarator').type !== 'field_identifier' || kids(it).some(x => x.type === 'type_qualifier' || x.type === 'storage_class_specifier')) return false;
            const w = typeWord(F(it, 'type').text);
            const v = dv ? ex(dv) : '';
            if (!w || v == null || (dv && kids(it).some(x => x.type === 'initializer_list'))) return false;
            o.say(depth + 1, `field ${ds[0].text}: ${w}${dv ? ' = ' + v : ''}`);
            return true;
          }
          if (it.type === 'function_definition') {
            const d = F(it, 'declarator');
            if (!F(it, 'type') && d && d.type === 'function_declarator' && F(d, 'declarator').text === name.text) {
              if (named(it).some(x => x.type === 'field_initializer_list')) return false;
              const ps = params(d);
              if (!ps) return false;
              o.say(depth + 1, `when made${ps.length ? ' using ' + ps.join(', ') : ''}`);
              fnBody(it, depth + 2, it.startIndex);
              return true;
            }
            const s = funcSentence(it, true);
            if (!s) return false;
            o.say(depth + 1, s);
            fnBody(it, depth + 2, it.startIndex);
            return true;
          }
          return false;
        };
        for (const it of items) {
          if (prevEnd != null && it.startPosition.row > prevEnd + 1) o.blank();
          prevEnd = it.endPosition.row;
          if (isComment(it)) { o.notes(depth + 1, it); continue; }
          o.parents.set(it.startIndex, n.startIndex);
          o.keyStack.push(it.startIndex);
          const m = o.mark();
          let done = false;
          if ((force.get(it.startIndex) || 0) < 2) { try { done = member(it); } catch (e) { done = false; } }
          o.keyStack.pop();
          if (!done) {
            o.undo(m);
            if (it.type === 'access_specifier') { if (!seenFirst) return false; o.rawLines(depth + 1, 'c++:', src, it, `${it.text}:`); }
            else o.rawLines(depth + 1, 'c++:', src, it);
          }
        }
        return true;
      }
      if (arduino && n.type === 'declaration') return stmt(n, depth, lvl);
      return false;
    }

    const items = named(tree);
    const main = arduino ? null : items.find(isMain);
    if (!arduino && main) {
      const d = F(main, 'declarator');
      if (named(F(d, 'parameters')).some(x => !isComment(x) && x.text !== 'void') || F(main, 'type').text !== 'int') return { fail: 'main takes inputs (argc, argv), which sentences can\'t say yet.' };
    }
    // everything but main goes first: sentences always put main last (which C++ allows)
    const rest = main ? items.filter(x => x !== main) : items;
    walkBlock(o, rest, 0, null, force, arduino ? 'c++:' : 'above main:', src, top);
    if (main) {
      if (o.lines.length) o.blank();
      let body = named(F(main, 'body'));
      const last = body.filter(x => !isComment(x)).pop();
      if (last && last.type === 'return_statement' && collapse(last.text) === 'return 0;') body = body.filter(x => x !== last);
      curFn = 'main';
      block(body, 0, null);
    }
    return o;
  }

  /* What counts as the same C++: std::x and x when the original says `using namespace std`, brackets
     around one expression, one-line bodies with or without braces, main last, and main's final
     `return 0` (main gives back 0 without it). ++x and x++ differ: a class can make them do different things,
     except as the step of a for loop that counts with an int it makes (for (int i = 0; …; ++i)), where nothing
     uses the value. A `break;` at the very end of a switch's last case does nothing, so it counts the same as none. */
  function cppRules(usingStd) {
    const R = {
      skip: (c) => c.type === ';' || c.type === '{' || c.type === '}' || (/^(preproc_include|using_declaration)$/.test(c.type) && c.parent && c.parent.type === 'translation_unit')   // compared on their own
        || (c.type === ':' && c.parent && c.parent.type === 'field_declaration_list'),   // (the colon of public:, which is compared)
      rewrite: (n) => {
        if (usingStd && (n.type === 'qualified_identifier' || n.type === 'qualified_type_identifier') && F(n, 'scope') && F(n, 'scope').text === 'std' && F(n, 'name')) return { node: F(n, 'name') };
        if (n.type === 'parenthesized_expression' && n.namedChildCount === 1 && n.parent && !/if_statement|while_statement|condition_clause|decltype/.test(n.parent.type)) return { node: n.namedChild(0) };
        if (n.type === 'update_expression' && n.parent && n.parent.type === 'for_statement') {
          const p = n.parent, upd = F(p, 'update'), init = F(p, 'initializer'), arg = F(n, 'argument');
          if (upd && upd.startIndex === n.startIndex && init && init.type === 'declaration' && F(init, 'type') && F(init, 'type').type === 'primitive_type' && arg && arg.type === 'identifier')
            return { t: 'for_step', k: n.startIndex, v: arg.text + (n.text.includes('++') ? '++' : '--') };
        }
        return null;
      },
      leaf: (n) => (usingStd && (n.type === 'type_identifier' || n.type === 'primitive_type') ? n.text.replace(/^std::/, '') : n.text),
      // a case's steps and a class's members are compared one by one, so one that differs is kept as code on its own
      block: (n) => n.type === 'translation_unit' || n.type === 'compound_statement' || n.type === 'case_statement' || n.type === 'field_declaration_list',
      after: (o, n) => {
        if (n.type === 'switch_statement') {
          const body = o.c.find(x => x.t === 'compound_statement'), last = body && body.c[body.c.length - 1];
          if (last && last.t === 'case_statement' && last.c.length && last.c[last.c.length - 1].t === 'break_statement') last.c.pop();
        }
        if (/^(if_statement|for_statement|for_range_loop|while_statement|do_statement)$/.test(n.type)) wrapBodies(o, n, ['consequence', 'body'], 'compound_statement');
        if (n.type === 'else_clause') { const c = named(n).find(x => !isComment(x)); if (c && c.type !== 'compound_statement' && c.type !== 'if_statement') { const i = o.c.findIndex(x => x.k === c.startIndex); if (i >= 0) o.c[i] = { t: 'compound_statement', k: c.startIndex, block: true, c: [o.c[i]] }; } }
        if (n.type === 'translation_unit') {   // main last, without its final return 0
          const mi = o.c.findIndex(x => x.t === 'function_definition' && x.isMain);
          if (mi >= 0) { const [m] = o.c.splice(mi, 1); o.c.push(m); }
        }
        if (n.type === 'function_definition' && /^main$/.test((F(F(n, 'declarator'), 'declarator') || {}).text || '')) {
          o.isMain = true;
          const body = o.c.find(x => x.t === 'compound_statement');
          if (body) { const last = body.c[body.c.length - 1]; if (last && last.t === 'return_statement' && hashOf(last) === 'return_statement(return:"return",number_literal:"0")') body.c.pop(); }
        }
      },
    };
    return R;
  }
  const includesOf = (tree) => named(tree).filter(x => x.type === 'preproc_include').map(x => collapse(F(x, 'path') ? F(x, 'path').text : x.text));
  const usingsOf = (tree) => named(tree).filter(x => x.type === 'using_declaration').map(x => collapse(x.text)).sort();

  /* ================================================================== */
  /* The driver: convert, check, keep what differs as code, check again  */
  /* ================================================================== */

  function compileBack(kind, text, env) {
    const sec = { id: 'x', file: { html: 'structure', css: 'styling', js: 'mechanics', cpp: 'program', arduino: 'sketch' }[kind], text };
    const shared = () => ({ ids: Object.fromEntries(Object.entries(env.ids || {}).map(([k, t]) => [k, { tag: t, line: -1 }])), groups: Object.fromEntries((env.groups || []).map(g => [g, true])), cssGroups: {}, addGroups: {} });
    if (kind === 'html') return env.WEB.compileHtml(sec, { ids: {}, groups: {}, cssGroups: {}, addGroups: {} });
    if (kind === 'css') return env.WEB.compileCss(sec, shared());
    if (kind === 'js') return env.WEB.compileJs(sec, shared());
    return env.CPP.compileCppProject({ kind: kind === 'arduino' ? 'arduino' : 'cpp', sections: [sec] }).results.x;
  }

  function check(kind, original, generated, env) {
    if (kind === 'html') {
      const a = htmlTree(original, env, env.pulled || []);
      const b = htmlTree(generated, env, ['style.css', 'script.js'], { style: !a.found.style, script: !a.found.script });
      if (a.doctype !== b.doctype) return { same: false, why: 'the doctype (the first line of the page)' };
      if (a.htmlAttrs !== b.htmlAttrs) return { same: false, why: 'the <html> tag (the page language or its other attributes)' };
      if (a.title !== b.title) return { same: false, why: 'the page title' };
      if (a.metas !== b.metas) return { same: false, why: 'the <meta> settings (character set, viewport…)' };
      if (a.bodyAttrs !== b.bodyAttrs) return { same: false, why: 'the <body> tag' };
      const h = cmp(a.head, b.head);
      if (h !== true) return { same: false, why: 'the <head>' };
      blameNear = true;
      let r;
      try { r = cmp(a.body, b.body); } finally { blameNear = false; }
      return r === true ? { same: true } : { same: false, culprits: r === false ? null : r };
    }
    const lang = kind === 'arduino' ? 'cpp' : kind;
    const ta = env.parse(lang, original), tb = env.parse(lang, generated);
    let usingStd = false;
    if (lang === 'cpp') {
      const inc = new Set(includesOf(tb));
      const missing = includesOf(ta).filter(x => !inc.has(x));
      if (missing.length) return { same: false, why: `the #include of ${missing.join(', ')}` };
      if (usingsOf(ta).join('\n') !== usingsOf(tb).join('\n')) return { same: false, why: 'the `using` lines' };
      usingStd = usingsOf(ta).includes('using namespace std;');
    }
    const rules = lang === 'js' ? JS_RULES : lang === 'css' ? CSS_RULES : cppRules(usingStd);
    const r = cmp(normalise(ta, rules), normalise(tb, rules));
    return r === true ? { same: true } : { same: false, culprits: r === false ? null : r };
  }

  function toSentences(kind, source, env) {
    const src = String(source).replace(/\r\n/g, '\n');
    const force = new Map();   // key -> 1 (say it the careful way) or 2 (keep it as code)
    let conv, last, gen;
    for (let round = 0; round < 40; round++) {
      conv = kind === 'html' ? htmlConvert(src, env, force) : kind === 'css' ? cssConvert(src, env, force) : kind === 'js' ? jsConvert(src, env, force) : cppConvert(src, env, force, kind === 'arduino');
      if (conv.fail) return { ok: false, error: conv.fail };
      const text = conv.lines.join('\n').replace(/\n{3,}/g, '\n\n').replace(/^\n+|\n+$/g, '') + '\n';
      gen = compileBack(kind, text, env);
      last = check(kind, src, gen.text, env);
      if (env.debug) env.debug({ round, text, generated: gen.text, check: last, errors: gen.info.flatMap((inf, i) => inf.errs.map(e => `${i + 1}: ${e}`)) });
      // sentences the translator complains about are kept as code too
      const bad = new Set();
      gen.info.forEach((inf, i) => { if (inf.errs.length && conv.keys[i] != null) bad.add(conv.keys[i]); });
      if (last.same && !bad.size) return result(conv, text, true);
      let added = 0;
      const blame = (k) => {
        let key = k;
        while (key != null && force.get(key) >= 2 && conv.parents.has(key)) key = conv.parents.get(key);
        if (key == null || force.get(key) >= 2) return;
        force.set(key, conv.careful.has(key) && !force.has(key) ? 1 : 2);
        added++;
      };
      let keys = [...bad, ...(!last.same && last.culprits ? last.culprits : [])];
      // C++: a name said with its type spelled out can put right the lines that use it ("length of input" needs
      // input to be text), so those go first and the rest are checked again
      if (kind === 'cpp' || kind === 'arduino') {
        const up = (k) => { let key = k; while (key != null && force.get(key) >= 2 && conv.parents.has(key)) key = conv.parents.get(key); return key; };
        const first = keys.filter(k => { const key = up(k); return key != null && !force.has(key) && conv.careful.has(key); });
        if (first.length) keys = first;
      }
      for (const k of keys) blame(k);
      if (!added) {
        if (force.has('ALL') || last.why) break;
        force.set('ALL', 2);
      }
      conv.text = text;
    }
    return result(conv, conv.lines.join('\n').replace(/\n{3,}/g, '\n\n').replace(/^\n+|\n+$/g, '') + '\n', false, last && last.why);
  }
  function result(conv, text, exact, why) {
    const lines = conv.lines.filter(l => l.trim() && !/^\s*note:/.test(l));
    const raw = lines.filter(l => /^\s*(?:html|css|js|c\+\+|above main|head):/.test(l)).length;
    return { ok: true, text, exact, reason: exact ? null : why ? `The sentences differ from the original in ${why}.` : 'Some parts could not be matched exactly.', lines: lines.length, words: lines.length - raw, kept: raw };
  }

  /* A page's own names (ids with their tags, classes) and the CSS and JS files it loads. */
  function pageInfo(parse, html) {
    const ids = {}, groups = new Set(), styles = [], scripts = [];
    const walk = (n) => {
      if (isEl(n)) {
        const tag = tagOf(n), a = attrsOf(n), get = (k) => (a.find(x => x.name === k) || {}).value;
        if (get('id') != null) ids[get('id')] = tag;
        for (const c of (get('class') || '').split(/\s+/).filter(Boolean)) groups.add(c);
        if (tag === 'link' && /stylesheet/i.test(get('rel') || '') && get('href')) styles.push(get('href'));
        if (n.type === 'script_element' && get('src')) scripts.push({ src: get('src'), module: get('type') === 'module' });
      }
      for (const c of named(n)) walk(c);
    };
    walk(parse('html', html));
    return { ids, groups: [...groups], styles, scripts };
  }

  /* Find the project file a page refers to ("/static/app.js", "../style.css"). */
  function resolveRef(fromPath, ref, names) {
    if (!ref || /^(?:[a-z]+:)?\/\//i.test(ref) || /^data:/.test(ref)) return null;
    const clean = ref.replace(/[?#].*$/, '');
    const dir = fromPath.split('/').slice(0, -1);
    const norm = (parts) => { const out = []; for (const p of parts) { if (p === '..') out.pop(); else if (p && p !== '.') out.push(p); } return out.join('/'); };
    const direct = clean.startsWith('/') ? null : norm([...dir, ...clean.split('/')]);
    if (direct && names.includes(direct)) return direct;
    const tail = norm(clean.split('/'));
    const hits = names.filter(n => n === tail || n.endsWith('/' + tail));
    return hits.length ? hits.sort((x, y) => x.length - y.length)[0] : null;
  }

  /* A whole page as a website project: Structure from the page, Styling from its own CSS files,
     Mechanics from its own script (when it has exactly one ordinary script). */
  function website(page, files, env) {
    const names = files.map(f => f.name);
    const info = pageInfo(env.parse, page.source);
    const notes = [];
    const cssFiles = [], pulled = [];
    for (const href of info.styles) { const p = resolveRef(page.name, href, names); if (p && /\.css$/i.test(p)) { cssFiles.push(p); pulled.push(href); } }
    const local = info.scripts.map(s => ({ ...s, path: resolveRef(page.name, s.src, names) })).filter(s => s.path && /\.m?js$/i.test(s.path));
    let jsPath = null;
    if (local.length === 1 && !local[0].module) { jsPath = local[0].path; pulled.push(local[0].src); }
    else if (local.length) notes.push(local.some(s => s.module) ? 'The page\'s scripts are JavaScript modules, so they stay linked as they are instead of becoming Mechanics.' : 'The page loads several of its own scripts, so they stay linked as they are instead of becoming Mechanics.');
    if (cssFiles.length > 1) notes.push(`Its ${cssFiles.length} style files were joined into Styling, in the order the page loads them.`);
    const source = (p) => (files.find(f => f.name === p) || { source: '' }).source;
    const e = { ...env, ids: info.ids, groups: info.groups };
    const out = {
      structure: toSentences('html', page.source, { ...env, pulled }),
      styling: cssFiles.length ? toSentences('css', cssFiles.map(source).join('\n'), e) : null,
      mechanics: jsPath ? toSentences('js', source(jsPath), e) : null,
    };
    return { parts: out, notes, cssFiles, jsPath };
  }

  const api = { toSentences, check, htmlTree, pageParts: (tree) => pageParts(tree), decode, pageInfo, resolveRef, website };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.IntuiConvert = api;
})(typeof window !== 'undefined' ? window : globalThis);

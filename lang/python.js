/* IntuCode — Python language pack.
 *
 * Turns sentences into Python, one sentence line -> one Python line.
 * Everything here is plain rules: ordered regular expressions for sentences,
 * phrase swaps for expressions, and a symbol table that remembers what each
 * name is (number, text, list, tool...) so sentences like "add 1 to x" can
 * pick the right Python.
 *
 * Every rule can attach a note. Notes are how the tool explains the choices
 * it made, so the person stays connected to the code.
 */
(function () {
  'use strict';

  const PY_KEYWORDS = new Set(['False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue', 'def', 'del', 'elif', 'else', 'except', 'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 'try', 'while', 'with', 'yield']);
  const BUILTINS = new Set(['print', 'input', 'len', 'int', 'float', 'str', 'bool', 'list', 'dict', 'range', 'sum', 'min', 'max', 'abs', 'round', 'sorted', 'reversed', 'enumerate', 'zip', 'type', 'isinstance', 'any', 'all', 'set', 'tuple', 'map', 'filter', 'chr', 'ord', 'pow', 'divmod']);
  const MODULES = new Set(['random', 'math', 'time', 'sys', 'string', 'datetime']);
  const WORD_NUMBERS = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, twenty: 20, fifty: 50, hundred: 100 };
  const FILE_ORDER = { settings: 0, tools: 1, main: 2 };
  const ALWAYS_KNOWN = new Set(['self', 'cls', '__name__', '__file__', 'Exception', 'ValueError', 'TypeError', 'KeyError', 'IndexError', 'open', 'dict', 'object', 'super', 'getattr', 'setattr', 'hasattr', 'isinstance', 'iter', 'next', 'repr', 'format', 'vars', 'id', 'hash', 'callable', 'exit']);

  /* Names match exactly first. If there is no exact match, a different-case spelling is used
     when it is the only one ("Score" finds score), because Python itself is case-sensitive:
     a class Account and a variable account are different things. */
  class SymTable {
    constructor(src) { this.map = new Map(); this.lower = new Map(); if (src) for (const [k, v] of src) this.set(k, v); }
    set(k, v) {
      this.map.set(k, v);
      const l = k.toLowerCase(), list = this.lower.get(l) || [];
      if (!list.includes(k)) list.push(k);
      this.lower.set(l, list);
      return this;
    }
    get(k) {
      k = String(k);
      if (this.map.has(k)) return this.map.get(k);
      const list = this.lower.get(k.toLowerCase());
      return list && list.length === 1 ? this.map.get(list[0]) : undefined;
    }
    has(k) { return this.get(k) !== undefined; }
    values() { return this.map.values(); }
    keys() { return this.map.keys(); }
    get size() { return this.map.size; }
    [Symbol.iterator]() { return this.map[Symbol.iterator](); }
  }

  /* ------------------------------------------------------------------ */
  /* Small helpers                                                       */
  /* ------------------------------------------------------------------ */

  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const isNum = s => /^-?\d+(\.\d+)?$/.test(String(s).trim());
  const code = s => '`' + s + '`';

  function lev(a, b) {
    const m = a.length, n = b.length;
    if (!m) return n; if (!n) return m;
    let prev = Array.from({ length: n + 1 }, (_, i) => i);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = cur;
    }
    return prev[n];
  }

  function closest(word, list, max = 2) {
    let best = null, bestD = max + 1;
    for (const c of list) {
      const d = lev(word.toLowerCase(), c.toLowerCase());
      if (d < bestD) { best = c; bestD = d; }
    }
    return best;
  }

  /* Quoted text with its words hidden (same length, quote marks kept), so sentence words inside
     quotes never count: "add "Walk to the shop" to tasks" splits at the second "to". */
  const maskQuoted = (s) => s.replace(/"(?:[^"\\]|\\.)*"?|(?<![A-Za-z0-9_])[rRbBuUfF]{0,2}'(?:[^'\\]|\\.)*'?/g, (m) => {
    const q = m.search(/["']/), end = m.length > q + 1 && m[m.length - 1] === m[q] ? 1 : 0;
    return m.slice(0, q + 1) + '\u0001'.repeat(m.length - q - 1 - end) + m.slice(m.length - end);
  });
  /* Like s.match(re), but words inside quotes can't match; the groups hold the real text. */
  const withIndices = new Map();   // by source: a regex written in a function is a new object each time
  function qmatch(s, re) {
    let red = withIndices.get(re.source + '/' + re.flags);
    if (!red) { red = new RegExp(re.source, re.flags.replace(/[gd]/g, '') + 'd'); withIndices.set(re.source + '/' + re.flags, red); }
    const m = maskQuoted(s).match(red);
    if (!m) return null;
    const out = m.indices.map(p => (p ? s.slice(p[0], p[1]) : undefined));
    out.index = m.index; out.input = s;
    return out;
  }

  /* Text in double quotes: {name} fills in a value, and {{ and }} are braces themselves. */
  const FILL = /\{\{|\}\}|\{([^{}]+)\}|[{}]/g;
  const fillsIn = (body) => [...body.matchAll(FILL)].some(m => m[1] != null);

  /* Which triple-quoted text is still open at the end of this line of Python? ('"""', "'''" or null)
     `open` is the one already open when the line starts. */
  function openString(code, open = null) {
    for (let i = 0; i < code.length;) {
      if (open) {
        if (code[i] === '\\') i += 2;
        else if (code.startsWith(open, i)) { open = null; i += 3; }
        else i++;
        continue;
      }
      const c = code[i];
      if (c === '#') return null;
      if (c === '"' || c === "'") {
        if (code.startsWith(c.repeat(3), i)) { open = c.repeat(3); i += 3; continue; }
        for (i++; i < code.length && code[i] !== c; i += code[i] === '\\' ? 2 : 1);
      }
      i++;
    }
    return open;
  }

  /* Split on commas and the word "and", but not inside quotes or brackets. */
  function splitItems(s, useAnd = true) {
    const parts = []; let depth = 0, quote = null, cur = '';
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (quote) { cur += c; if (c === '\\') { cur += s[++i] || ''; } else if (c === quote) quote = null; continue; }
      if (c === '"' || c === "'") { quote = c; cur += c; continue; }
      if ('([{'.includes(c)) depth++;
      if (')]}'.includes(c)) depth--;
      if (depth === 0 && c === ',') { parts.push(cur); cur = ''; continue; }
      if (depth === 0 && useAnd && /\s/.test(c) && /^\s+and\s+/i.test(s.slice(i))) {
        const m = s.slice(i).match(/^\s+and\s+/i);
        parts.push(cur); cur = ''; i += m[0].length - 1; continue;
      }
      cur += c;
    }
    parts.push(cur);
    return parts.map(p => p.trim()).filter(p => p.length);
  }

  /* ------------------------------------------------------------------ */
  /* Expressions: phrase swaps                                           */
  /* ------------------------------------------------------------------ */

  // Brackets with brackets inside, up to 4 deep (a regular expression can't count further).
  const nest = (o, c) => { let s = `[^${o}${c}]*`; for (let i = 0; i < 3; i++) s = `(?:[^${o}${c}]|${o}${s}${c})*`; return o + s + c; };
  const PAREN = nest('\\(', '\\)'), SQUARE = nest('\\[', '\\]');
  // An operand: a protected string, a number, a name or a bracketed group, then any .names, calls and indexes.
  const OPD = String.raw`(?:⟦\d+⟧|-?\d+(?:\.\d+)?|[A-Za-z_]\w*|${PAREN}|${SQUARE})(?:\.[A-Za-z_]\w*|${PAREN}|${SQUARE})*`;
  // "\b" can't sit before quoted text (⟦0⟧), so operands use a look-behind instead.
  const R = (src) => new RegExp(src.replace(/\\b\(OPD\)/g, '(?<![\\w.])(OPD)').replace(/OPD/g, OPD), 'gi');

  const EXPR_RULES = [
    // Looking things up
    { re: R(String.raw`\bfirst (?:item|one|thing) (?:of|in|from) (OPD)`), to: '$1[0]', note: 'Python counts positions from 0, so the first item is `[0]`.' },
    { re: R(String.raw`\blast (?:item|one|thing) (?:of|in|from) (OPD)`), to: '$1[-1]', note: '`[-1]` counts from the end: it is always the last item.' },
    { re: R(String.raw`\bitem (?!is\b|not\b|in\b)(OPD) (?:of|in|from) (OPD)`), to: '$2[$1]', note: 'Square brackets pick one item. For lists, Python counts from 0: item 0 is the first one.' },
    // Functions written as words, e.g. "length of x"
    { re: R(String.raw`\b(?:length|size) of (OPD)`), to: 'len($1)', repeat: true },
    { re: R(String.raw`\b(?:how many (?:items )?(?:are )?in|number of items in|count of) (OPD)`), to: 'len($1)', repeat: true },
    { re: R(String.raw`\b(?:sum|total) of (OPD)`), to: 'sum($1)', repeat: true },
    { re: R(String.raw`\b(?:biggest|largest|highest|maximum|max) (?:of|in) (OPD)`), to: 'max($1)', repeat: true },
    { re: R(String.raw`\b(?:smallest|lowest|minimum|min) (?:of|in) (OPD)`), to: 'min($1)', repeat: true },
    { re: R(String.raw`\bsquare root of (OPD)`), to: 'math.sqrt($1)', use: 'math', note: '`math.sqrt` lives in the `math` module, so it is imported for you.' },
    { re: R(String.raw`\babsolute (?:value )?of (OPD)`), to: 'abs($1)' },
    { re: R(String.raw`\b(OPD) rounded to (OPD) (?:decimal )?places?`), to: 'round($1, $2)' },
    { re: R(String.raw`\b(OPD) rounded\b`), to: 'round($1)' },
    { re: R(String.raw`\bsorted (OPD)`), to: 'sorted($1)', note: '`sorted()` makes a new sorted copy and leaves the original list alone.' },
    { re: R(String.raw`\b(OPD) sorted\b`), to: 'sorted($1)', note: '`sorted()` makes a new sorted copy and leaves the original list alone.' },
    { re: R(String.raw`\b(OPD) as (?:a )?(?:whole )?number\b`), to: 'int($1)', note: '`int()` turns text like "42" into the whole number 42. It stops with an error if the text is not a number.' },
    { re: R(String.raw`\b(OPD) as (?:a )?decimal(?: number)?\b`), to: 'float($1)', note: '`float()` turns text into a decimal number, like 3.5.' },
    { re: R(String.raw`\b(OPD) as text\b`), to: 'str($1)', note: '`str()` turns a value into text, so it can be joined to other text.' },
    { re: R(String.raw`\b(OPD) in (?:capitals|capital letters|uppercase|upper case)\b`), to: '$1.upper()' },
    { re: R(String.raw`\b(OPD) in (?:lowercase|lower case|small letters)\b`), to: '$1.lower()' },
    { re: R(String.raw`\bpairs (?:of|in) (OPD)`), to: '$1.items()', note: '`.items()` gives the key and value of each entry in a dictionary, as pairs.' },
    // Randomness
    { re: R(String.raw`\brandom (?:whole )?number (?:from|between) (OPD) (?:to|and) (OPD)`), to: 'random.randint($1, $2)', use: 'random', note: '`random.randint(a, b)` can give back a or b, and anything in between. The `random` module is imported for you.' },
    { re: R(String.raw`\brandom (?:decimal|fraction)\b`), to: 'random.random()', use: 'random', note: '`random.random()` gives a decimal from 0 up to (not including) 1.' },
    { re: R(String.raw`\brandom (?:item|choice|one|pick|thing) (?:from|of|in) (OPD)`), to: 'random.choice($1)', use: 'random', note: '`random.choice()` picks one item from a list. The `random` module is imported for you.' },
    // Powers
    { re: R(String.raw`\b(OPD) squared\b`), to: '$1 ** 2', note: '`**` means "to the power of".' },
    { re: R(String.raw`\b(OPD) cubed\b`), to: '$1 ** 3', note: '`**` means "to the power of".' },
    // Comparisons that need both sides
    { re: R(String.raw`\b(OPD) is (?:exactly )?divisible by (OPD)`), to: '$1 % $2 == 0', note: '`%` gives the remainder after dividing. A remainder of 0 means it divides exactly.' },
    { re: R(String.raw`\b(OPD) is even\b`), to: '$1 % 2 == 0', note: '`% 2` is the remainder after dividing by 2: 0 for even numbers.' },
    { re: R(String.raw`\b(OPD) is odd\b`), to: '$1 % 2 == 1', note: '`% 2` is the remainder after dividing by 2: 1 for odd numbers.' },
    { re: R(String.raw`\b(OPD) (?:does not|doesn't) contain (OPD)`), to: '$2 not in $1' },
    { re: R(String.raw`\b(OPD) contains (OPD)`), to: '$2 in $1', note: 'Python writes "list contains x" the other way round: `x in list`.' },
    // Comparisons
    { re: /\bis not (?:nothing|none)\b/gi, to: ' ⟪!⟫ None', note: '`is not None` checks that something has a value.' },
    { re: /\bis (?:nothing|none)\b/gi, to: ' ⟪⟫ None', note: '`is None` checks whether something has no value.' },
    { re: /\bis not (?:in|inside|one of)\b/gi, to: ' not in ' },
    { re: /\bis (?:greater|more|bigger|higher|larger) than or equal to\b|\bis at least\b/gi, to: ' >= ' },
    { re: /\bis (?:less|smaller|lower|fewer) than or equal to\b|\bis at most\b/gi, to: ' <= ' },
    { re: /\bis (?:greater|more|bigger|higher|larger) than\b|\bis over\b|\bis above\b/gi, to: ' > ' },
    { re: /\bis (?:less|smaller|lower|fewer) than\b|\bis under\b|\bis below\b/gi, to: ' < ' },
    { re: /\bis not (?:equal to|the same as)\b|\b(?:does not|doesn't) equal\b|\bisn't\b|\bis not\b/gi, to: ' != ', note: '`!=` means "is not equal to".' },
    { re: /\bis (?:in|inside|one of)\b/gi, to: ' in ' },
    { re: /\bis (?:equal to|the same as)\b|\bequals\b|\bis\b/gi, to: ' == ', note: '`==` compares two values. A single `=` would store a value instead.' },
    // Maths
    { re: /\bplus\b|\badded to\b|\bjoined (?:with|to)\b|\bfollowed by\b/gi, to: ' + ' },
    { re: /\bminus\b|\btake away\b/gi, to: ' - ' },
    { re: /\btimes\b|\bmultiplied by\b/gi, to: ' * ' },
    { re: /\bdivided by\b/gi, to: ' / ', note: '`/` always gives a decimal answer: 7 / 2 is 3.5.' },
    { re: /\bmod\b|\bmodulo\b|\bremainder after dividing by\b/gi, to: ' % ', note: '`%` gives the remainder after dividing: 7 % 3 is 1.' },
    { re: /\bto the power of\b/gi, to: ' ** ' },
    // Plain values
    { re: /\ban empty list\b|\bempty list\b/gi, to: '[]' },
    { re: /\ban empty dictionary\b|\bempty dictionary\b/gi, to: '{}' },
    { re: /\bempty text\b/gi, to: '""' },
    { re: /\b(?:yes|true)\b/gi, to: 'True' },
    { re: /\b(?:no|false)\b/gi, to: 'False' },
    { re: /\b(?:nothing|none)\b/gi, to: 'None' },
    { re: /\botherwise\b/gi, to: ' else ', note: '`a if condition else b` picks one of two values in a single line.' },
    { re: /\b(and|or|not)\b/gi, to: (m) => m.toLowerCase() },
  ];
  // Rules ending in an operand, like "length of x": what follows it must not belong to it (see tExpr).
  for (const r of EXPR_RULES) r.endsInOperand = r.re.source.endsWith(`(${OPD})`);

  /* ------------------------------------------------------------------ */
  /* The per-line context: collects notes, warnings, errors              */
  /* ------------------------------------------------------------------ */

  function makeCtx(env, file, info, blockState) {
    const x = {
      env, file, info,
      pass: env.pass,
      get syms() { return env.syms; },
      note(s) { if (!info.notes.includes(s)) info.notes.push(s); },
      warn(s) { if (env.pass === 2 && !info.warns.includes(s)) info.warns.push(s); },
      err(s) { if (!info.errs.includes(s)) info.errs.push(s); },
      use(mod) { env.imports.add(mod); },
      stack: blockState.stack,
      fn: blockState.fn,
      level: blockState.level,
      inside(type) {
        for (let i = this.stack.length - 1; i >= 0; i--) {
          if (this.stack[i].type === type) return true;
          if (type === 'loop' && this.stack[i].type === 'def') return false;
        }
        return false;
      },
    };
    return x;
  }

  /* Turn a name slot into a Python name, e.g. "High Score" -> high_score */
  function toName(raw, x, opts = {}) {
    let t = String(raw || '').trim();
    t = t.replace(/^(?:the|my|a new|an|a)\s+(?=\S+)/i, (m) => (/^a$/i.test(t) ? m : ''));
    t = t.replace(/^(?:variable|value|number|text|tool|function)\s+(?:called|named)\s+/i, '').replace(/^(?:called|named)\s+/i, '');
    if (!t) { x.err('A name is missing here.'); return '_'; }
    const slot = t.match(/‹[^›]*›/);
    if (slot) { x.err(`Fill in the ${slot[0]} slot.`); return '_'; }
    // Sentence-style names with spaces become snake_case; single words keep their case (API_KEY stays API_KEY).
    let py = /\s/.test(t) ? t.toLowerCase().replace(/[\s\-]+/g, '_') : t.replace(/-/g, '_');
    const same = x.syms.get(py);
    if (same && same.py !== py) {
      if (!opts.define) py = same.py;
      else if (same.kind !== 'class' && same.kind !== 'function') x.warn(`${code(py)} and ${code(same.py)} are different names in Python, because capital letters matter.`);
    }
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(py)) {
      x.err(`"${t}" can't be a name. Names use letters, numbers and spaces, and can't start with a number or contain quotes.`);
      return '_';
    }
    if (PY_KEYWORDS.has(py) || PY_KEYWORDS.has(py[0].toUpperCase() + py.slice(1))) {
      x.err(`"${t}" is one of Python's own words, so it can't be a name. Try something like "my ${t}" or "${t} value".`);
    }
    if (opts.define && BUILTINS.has(py)) {
      x.warn(`${code(py)} is already a built-in Python tool. Naming something ${code(py)} hides the built-in one.`);
    }
    if (/\s/.test(t)) x.note(`Python names can't contain spaces, so "${t.toLowerCase()}" is written ${code(py)}.`);
    return py;
  }

  function declare(x, py, display, kind, extra = {}) {
    const env = x.env;
    let s = env.syms.map.get(py);   // declaring needs the exact spelling
    if (!s) {
      s = { py, display: display.toLowerCase(), kind: kind || 'value', file: x.file, line: x.info.line, scope: x.fn ? 'local' : 'module', ...extra };
      env.syms.set(py, s);
      if (/\s/.test(s.display)) env.multiDirty = true;
    } else if ((s.kind === 'value' || s.kind === 'unknown') && kind && kind !== 'value') {
      s.kind = kind;
    }
    if (extra.params && !s.params) s.params = extra.params;
    const firstTime = !env.seen.has(py);
    env.seen.add(py);
    return firstTime;
  }

  function multiNames(env) {
    if (env.multiDirty || !env.multi) {
      env.multi = [...env.syms.values()]
        .filter(s => /\s/.test(s.display))
        .sort((a, b) => b.display.length - a.display.length)
        .map(s => ({ py: s.py, re: new RegExp('\\b' + s.display.split(/\s+/).map(esc).join('[\\s_-]+') + '\\b', 'gi') }));
      env.multiDirty = false;
    }
    return env.multi;
  }

  /* Record assignments inside a tool so `global` can be added when needed. */
  function assigned(x, py) {
    const fn = x.fn;
    if (!fn || x.pass !== 2) return;
    if (fn.locals.has(py)) return;
    const s = x.syms.get(py);
    const outside = s && s.scope === 'module' && s.file === x.file;
    const otherFile = s && s.scope === 'module' && s.file !== x.file;
    if (outside) {
      fn.globals.add(py);
      x.note(`${code(py)} lives outside this tool, so the translator adds ${code('global ' + py)} at the top of the tool. Without it, Python would make a separate copy inside the tool.`);
    } else if (otherFile) {
      fn.globals.add(py);
      x.warn(`${code(py)} is set in another section. Changing it inside a tool only changes this section's copy. To share a result, use "give back" and store it where you run the tool.`);
    } else {
      fn.locals.add(py);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Expression translation                                              */
  /* ------------------------------------------------------------------ */

  /* Brackets right after a phrase like "length of x" would apply to its result: len(x) (…) runs the
     number len gives back. That is an error on the line, never Python that is silently wrong. */
  function looseBrackets(m, q, strs, x) {
    const after = q.slice(m.index + m[0].length), last = m[m.length - 1];
    const said = (t) => t.trim().replace(/⟦(\d+)⟧/g, (_, i) => strs[+i]);
    if (/^\s+[([]/.test(after)) {
      const br = after.trim()[0] === '(' ? '(…)' : '[…]';
      x.err(`The brackets after "${said(m[0])}" don't belong to anything.` + (/^[A-Za-z_]\w*$/.test(last) ? ` If they go with ${code(last)}, write them right after it, with no space: ${code(last + br)}.` : ''));
    } else if (/^[([]/.test(after)) {
      x.err(`The translator can't follow the brackets in "${said(m[0] + after.match(/^\S*/)[0])}": too many inside each other, or one isn't closed. Work out the inner part on the line before and store it, or write this line as python:.`);
    }
  }

  function tExpr(src, x, opts = {}) {
    let s = String(src == null ? '' : src).trim();
    if (!s) { x.err('Something is missing here: a value or a condition.'); return 'None'; }
    const slot = s.match(/‹[^›]*›/);
    if (slot) { x.err(`Fill in the ${slot[0]} slot.`); s = s.replace(/‹[^›]*›/g, '_'); }

    // 1. Protect text in quotes so nothing inside is swapped.
    const strs = [];
    let q = s.replace(/(?<![\w])[rRbBuUfF]{0,2}(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, (m) => { strs.push(m); return ` ⟦${strs.length - 1}⟧ `; });
    if (/["]/.test(q)) { x.err('A piece of text is missing its closing quote mark (").'); q = q.replace(/"/g, ''); }
    if (/(^|\s)'|'(\s|$)/.test(q)) { x.err("A piece of text is missing its closing quote mark (')."); }

    // 2. Multi-word names -> snake_case names. Brackets or a .name right after one stay attached: all_notes().
    for (const m of multiNames(x.env)) q = q.replace(m.re, (w, off, all) => ' ' + m.py + (/^(?:[([]|\.[A-Za-z_])/.test(all.slice(off + w.length)) ? '' : ' '));
    // 2b. A tool's name and its brackets belong together even with a space between: "all notes ()" runs all_notes.
    q = q.replace(/(?<![\w.])([A-Za-z_]\w*)\s+\(/g, (w, id) => {
      const kind = x.syms.get(id)?.kind;
      return (kind ? kind === 'function' || kind === 'class' : BUILTINS.has(id)) ? id + '(' : w;
    });

    // 3. Filler words.
    q = q.replace(/\bthe\b/gi, ' ').replace(/\s+/g, ' ').trim();

    // 4. A single = in a condition almost always means "compare".
    if (opts.cond && /(^|[^=!<>])=(?!=)/.test(q)) {
      q = q.replace(/(^|[^=!<>])=(?!=)/g, '$1 == ');
      x.note('In a condition, `=` was changed to `==`. In Python `=` stores a value and `==` compares two values.');
    }

    // 4b. "wait for x" inside a value means await (used with async tools).
    if (/\bwait for\b/i.test(q)) { q = q.replace(/\bwait for\b/gi, ' await '); x.note('`await` waits for an async task to finish before carrying on.'); }

    // Names bound inside the expression itself (comprehensions, lambdas) are not "unknown".
    const bound = new Set();
    for (const m of q.matchAll(/\bfor\s+([A-Za-z_]\w*(?:\s*,\s*[A-Za-z_]\w*)*)\s+in\b/g)) m[1].split(/\s*,\s*/).forEach(n => bound.add(n));
    for (const m of q.matchAll(/\blambda\s+([^:]*):/g)) m[1].split(/\s*,\s*/).forEach(n => bound.add(n.replace(/=.*/, '').trim()));

    // 5. Phrase swaps.
    for (const r of EXPR_RULES) {
      let guard = 0, prev;
      do {
        prev = q;
        if (r.endsInOperand) for (const m of q.matchAll(r.re)) looseBrackets(m, q, strs, x);
        q = q.replace(r.re, r.to);
        if (q !== prev) {
          if (r.note) x.note(r.note);
          if (r.use) x.use(r.use);
        }
      } while (r.repeat && q !== prev && ++guard < 6);
      q = q.replace(/\s+/g, ' ');
    }

    // 6. Check every name.
    q = q.replace(/(?<![\w.⟦⟪])([A-Za-z_]\w*)\b(?!⟫)/g, (m, id, off, whole) => {
      if (PY_KEYWORDS.has(id) || bound.has(id)) return id;
      if (id === '_' && x.info.errs.some(e => e.startsWith('Fill in the'))) return id; // an unfilled ‹slot›, already reported
      if (/^\s*=(?!=)/.test(whole.slice(off + m.length))) return id; // keyword argument, e.g. end=""
      const low = id.toLowerCase();
      if (x.syms.has(id)) {
        const s = x.syms.get(id);
        if (x.pass === 2 && s.scope === 'module' && FILE_ORDER[s.file] > FILE_ORDER[x.file]) {
          x.warn(`${code(s.py)} is set in ${sectionTitle(s.file)}, which this section can't see. Set it here, or pass it into the tool as an input.`);
        }
        return s.py;
      }
      if (BUILTINS.has(id) || ALWAYS_KNOWN.has(id)) return id;
      if (MODULES.has(id)) { x.use(id); return id; }
      if (low in WORD_NUMBERS) return String(WORD_NUMBERS[low]);
      if (x.pass === 2) {
        const guess = closest(low, [...x.syms.values()].map(v => v.py), 2);
        x.warn(`${code(id)} hasn't been set anywhere yet.` + (guess ? ` Did you mean ${code(guess)}?` : ' Set it first, for example "set ' + id + ' to 0".'));
      }
      return id;
    });

    q = q.replace(/⟪!⟫/g, 'is not').replace(/⟪⟫/g, 'is');

    // 7. Tidy spacing. A lone = left now is a keyword argument, like end="".
    q = q.replace(/\s*(?<![=!<>])=(?!=)\s*/g, '=');
    q = q.replace(/\s+/g, ' ').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')').replace(/\s+,/g, ',').replace(/\[\s+/g, '[').replace(/\s+\]/g, ']').trim();

    // 8. Put the text back. Text with {name} inside becomes an f-string; {{ and }} are braces.
    q = q.replace(/⟦(\d+)⟧/g, (m, i) => {
      const str = strs[+i];
      if (/^[rRbBuUfF]/.test(str)) return str; // already Python (f"…", r"…"): keep exactly
      if (str[0] !== '"' || !/[{}]/.test(str)) return str;   // only double-quoted text fills in {names}; 'single' stays exact
      if (!fillsIn(str)) return str.replace(/\{\{/g, '{').replace(/\}\}/g, '}');
      x.note('Text with {…} inside becomes an f-string (the `f` before the quotes). Python swaps in the current value of whatever is in the curly brackets. (A brace itself is written twice: {{ or }}.)');
      return 'f' + str.replace(FILL, (mm, e) => (e != null ? '{' + tExpr(e, x) + '}' : mm.length === 2 ? mm : mm + mm));
    });
    return q;
  }

  /* Best guess at what kind of value an expression makes. */
  function kindOf(py, x) {
    const t = py.trim();
    if (/^f?["']/.test(t) && !/["']\s*[-*/]/.test(t)) return 'text';
    if (isNum(t)) return 'number';
    if (/^\[/.test(t) || /^sorted\(/.test(t)) return 'list';
    if (/^\{/.test(t)) return 'dict';
    if (/^(True|False)$/.test(t)) return 'yesno';
    if (/^(int|float|len|sum|abs|round|random\.randint|random\.random|math\.)\b/.test(t)) return 'number';
    if (/^(str|input)\(|\.(upper|lower)\(\)$/.test(t)) return 'text';
    if (/^[A-Za-z_]\w*$/.test(t) && x.syms.has(t)) return x.syms.get(t).kind;
    if (/^[\w\s+\-*/%().]+$/.test(t)) {
      const ids = t.match(/[A-Za-z_]\w*/g) || [];
      if (ids.every(id => x.syms.get(id)?.kind === 'number')) return 'number';
    }
    return 'value';
  }

  const KIND_WORDS = { number: 'a number', text: 'text', list: 'a list', dict: 'a dictionary', yesno: 'a yes/no value', function: 'a tool', value: 'a value' };

  /* ------------------------------------------------------------------ */
  /* Sentences                                                           */
  /* ------------------------------------------------------------------ */

  const RULES = [];
  const rule = (re, fn) => RULES.push({ re, fn });

  // --- Values ---------------------------------------------------------
  function setTarget(target, x) {
    let m;
    if ((m = qmatch(target, /^(?:the\s+)?item\s+(.+?)\s+(?:of|in)\s+(.+)$/i))) {
      const coll = tExpr(m[2], x);
      const key = tExpr(m[1], x);
      const k = x.syms.get(coll)?.kind;
      x.note(k === 'dict' ? `${code(coll + '[' + key + ']')} stores the value under the key ${code(key)} in the dictionary.` : `${code(coll + '[' + key + ']')} replaces one item. Positions start at 0.`);
      return { py: `${coll}[${key}]` };
    }
    if ((m = target.match(/^(?:the\s+)?(first|last)\s+item\s+(?:of|in)\s+(.+)$/i))) {
      const coll = tExpr(m[2], x);
      return { py: `${coll}[${m[1].toLowerCase() === 'first' ? 0 : -1}]` };
    }
    return null;
  }

  function doSet(nameRaw, valueRaw, x, verb) {
    const tgt = setTarget(nameRaw, x);
    let value;
    const call = qmatch(valueRaw, /^(?:the\s+)?(?:result|answer|output) of\s+(.+?)(?:\s+(?:with|using|on)\s+(.+))?$/i);
    if (call) value = callExpr(call[1], call[2], x);
    else value = tExpr(valueRaw, x);
    if (tgt) return { py: `${tgt.py} = ${value}` };
    if (/^[A-Za-z_]\w*(\.[A-Za-z_]\w*)+$/.test(nameRaw.trim())) {
      x.note(`Stores the value in ${code(nameRaw.trim())}, a value that belongs to an object.`);
      return { py: `${nameRaw.trim()} = ${value}` };
    }
    const py = toName(nameRaw, x, { define: true });
    const kind = kindOf(value, x);
    const first = declare(x, py, nameRaw.replace(/^(?:the|my)\s+/i, ''), kind);
    assigned(x, py);
    if (x.pass === 2) {
      if (first) x.note(`Creates ${code(py)} and stores ${KIND_WORDS[kind] || 'a value'} in it. \`=\` means "store", not "equals".`);
      else x.note(`Changes what is stored in ${code(py)}. The old value is replaced.`);
    }
    return { py: `${py} = ${value}` };
  }

  function callExpr(nameRaw, argsRaw, x) {
    const raw = nameRaw.trim();
    const dotted = /^[A-Za-z_]\w*(\.[A-Za-z_]\w*)+$/.test(raw);
    const fnName = dotted ? raw : toName(nameRaw, x);
    const s = dotted ? null : x.syms.get(fnName);
    const args = argsRaw && !/^nothing$/i.test(argsRaw.trim()) ? splitItems(argsRaw).map(a => tExpr(a, x)) : [];
    const keywords = args.some(a => /^[A-Za-z_]\w*=/.test(a));
    if (dotted) {
      x.note(`Runs ${code(fnName)}: a tool that belongs to ${code(raw.split('.').slice(0, -1).join('.'))}.`);
    } else if (x.pass === 2 && !s && (BUILTINS.has(fnName) || ALWAYS_KNOWN.has(fnName))) {
      // a Python built-in such as len or print
    } else if (x.pass === 2 && s && ['value', 'class', 'module'].includes(s.kind)) {
      // imported or created outside the sentences: trust it
    } else if (x.pass === 2) {
      if (!s) {
        const guess = closest(fnName, [...x.syms.values()].filter(v => v.kind === 'function').map(v => v.py), 3);
        x.err(`There's no tool called ${code(fnName)}.` + (guess ? ` Did you mean ${code(guess)}?` : ' Make one with "define ' + fnName.replace(/_/g, ' ') + ' using …" in Tools.'));
      } else if (s.kind !== 'function') {
        x.err(`${code(fnName)} is ${KIND_WORDS[s.kind] || 'a value'}, not a tool, so it can't be run.`);
      } else if (s.params && !keywords && (args.length > s.params.length || args.length < (s.required ?? s.params.length))) {
        x.err(`${code(fnName)} needs ${s.params.length} input${s.params.length === 1 ? '' : 's'} (${s.params.join(', ') || 'none'}), but ${args.length} ${args.length === 1 ? 'was' : 'were'} given.`);
      } else if (FILE_ORDER[s.file] > FILE_ORDER[x.file]) {
        x.warn(`${code(fnName)} is defined in ${sectionTitle(s.file)}, which this section can't see.`);
      }
    }
    return `${fnName}(${args.join(', ')})`;
  }

  // Escape hatch: raw Python, copied exactly.
  rule(/^(?:raw python|python|raw)\s*:\s?(.*)$/i, (m, x) => {
    x.note('Raw Python: copied exactly as written. The translator does not check it; Python will when you press Run.');
    const py = m[1];
    const a = py.match(/^\s*([A-Za-z_]\w*)\s*=[^=]/);
    if (a) declare(x, a[1], a[1], 'value');
    const imp = py.match(/^\s*(?:from\s+[\w.]+\s+)?import\s+(.+)$/);
    if (imp) for (const part of imp[1].replace(/[()]/g, '').split(',')) {
      const nm = part.trim().split(/\s+as\s+/).pop().split('.')[0];
      if (/^[A-Za-z_]\w*$/.test(nm)) declare(x, nm, nm, /^\s*import/.test(py) ? 'module' : 'value');
    }
    const cls = py.match(/^\s*class\s+([A-Za-z_]\w*)/);
    if (cls) declare(x, cls[1], cls[1], 'class');
    const d = py.match(/^\s*def\s+([A-Za-z_]\w*)\s*\(([^)]*)\)/);
    if (d) declare(x, d[1], d[1], 'function', { params: d[2].split(',').map(p => p.trim()).filter(Boolean) });
    const strOpen = openString(py);   // text in triple quotes that carries on to the next lines
    if (strOpen) x.note('The text in triple quotes carries on over the next lines, which are copied exactly (their spaces are part of the text).');
    const opens = !strOpen && /:\s*(#.*)?$/.test(py);
    const kw = (py.match(/^\s*(if|elif|else|for|while|def|async def|class|try|except|finally|with)\b/) || [])[1];
    const tag = { if: 'if', elif: 'elif', else: 'rawelse', try: 'try', except: 'except', finally: 'finally' }[kw];
    return { py, open: opens ? (d || /def$/.test(kw || '') ? 'def' : kw === 'for' || kw === 'while' ? 'loop' : kw === 'class' ? 'class' : 'block') : null, tag, strOpen, comment: /^\s*(#|$)/.test(py) };
  });

  rule(/^(?:note|comment)\s*:\s*(.*)$|^#\s?(.*)$/i, (m, x) => {
    return { py: '# ' + (m[1] ?? m[2] ?? ''), comment: true };
  });

  // A description: the text in triple quotes at the top of a tool, class or file (a docstring).
  // Several description lines in a row are one text; see translateSection.
  rule(/^description\s*:\s?(.*)$/i, (m, x) => {
    x.note('A description (docstring): the text in triple quotes at the top of a tool, class or file. Python keeps it as help text (`help()`, `__doc__`), so it is more than a note.');
    return { py: '"""' + m[1] + '"""', desc: m[1] };
  });

  rule(/^(?:use|import)\s+(?:the\s+)?([A-Za-z_]\w*)(\s+(?:module|library|toolkit))?$/i, (m, x) => {
    const mod = m[1].toLowerCase();
    if (!MODULES.has(mod) && !m[2] && !/^import/i.test(m[0])) return null; // "use hint" means run a tool
    declare(x, mod, mod, 'module');
    x.note(`Loads Python's ${code(mod)} module so its tools can be used. Modules are toolkits that come with Python.`);
    return { py: `import ${mod}` };
  });

  // --- Program structure: this file, web routes, decorators ---------------
  rule(/^(?:if|when) this file is (?:run|started) directly$/i, (m, x) => {
    x.note('`__name__` is `"__main__"` only when this file is started directly, not when another file imports it. Code here is the starting point.');
    return { py: 'if __name__ == "__main__":', open: 'if', tag: 'if' };
  });
  rule(/^when\s+([A-Za-z_][\w.]*)\s+(?:gets|receives)\s+(an?y? ?(?:web )?requests?|(?:GET|POST|PUT|DELETE|PATCH)(?:\s*(?:,|and|or)\s*(?:GET|POST|PUT|DELETE|PATCH))*)\s+(?:at|on|for)\s+("[^"]*"|'[^']*')$/i, (m, x) => {
    const methods = /request/i.test(m[2]) ? [] : m[2].toUpperCase().split(/\s*(?:,|AND|OR)\s*/).filter(Boolean);
    x.note(`A web route: when the web server gets ${methods.length ? methods.join(' or ') + ' requests' : 'a request'} for ${m[3]}, it runs the tool defined on the next line. (Flask writes this as a decorator starting with @.)`);
    return { py: `@${m[1]}.route(${m[3].replace(/^'|'$/g, '"')}${methods.length ? `, methods=[${methods.map(v => `"${v}"`).join(', ')}]` : ''})`, tag: 'decorator' };
  });
  rule(/^when\s+([A-Za-z_][\w.]*)\s+handles\s+(GET|POST|PUT|DELETE|PATCH)\s+(?:at|on|for)\s+("[^"]*"|'[^']*')(?:\s+with\s+(.+))?$/i, (m, x) => {
    const extra = m[4] ? splitItems(m[4]).map(a => tExpr(a, x)) : [];
    x.note(`A web route: when the server gets a ${m[2].toUpperCase()} request for ${m[3]}, it runs the tool defined on the next line.`);
    return { py: `@${m[1]}.${m[2].toLowerCase()}(${m[3]}${extra.length ? ', ' + extra.join(', ') : ''})`, tag: 'decorator' };
  });
  rule(/^decorate(?: it)? with\s+(.+)$/i, (m, x) => {
    x.note('A decorator (the line starting with @) adds behaviour to the tool or class defined right below it.');
    return { py: '@' + tExpr(m[1], x), tag: 'decorator' };
  });

  // --- Classes -----------------------------------------------------------
  rule(/^define\s+(?:a\s+)?class\s+([A-Za-z_]\w*)(?:\s+based on\s+(.+))?$/i, (m, x) => {
    declare(x, m[1], m[1], 'class');
    const bases = m[2] ? splitItems(m[2]).map(b => tExpr(b, x)) : [];
    x.note(`A class is a blueprint for objects. Each object made from ${code(m[1])} keeps its own values (written ${code('self.something')}) and can use the tools defined inside it.` + (bases.length ? ` It builds on ${bases.map(code).join(', ')}.` : ''));
    return { py: `class ${m[1]}${bases.length ? `(${bases.join(', ')})` : ''}:`, open: 'class' };
  });
  rule(/^field\s+([A-Za-z_]\w*)\s*:\s*(.+?)(?:\s+=\s+(.+))?$/i, (m, x) => {
    declare(x, m[1], m[1], 'value');
    x.note(`Declares that objects of this class have ${code(m[1])}, of type ${code(m[2].trim())}.` + (m[3] ? ' If none is given, it starts as ' + code(m[3].trim()) + '.' : ''));
    return { py: `${m[1]}: ${tExpr(m[2], x)}${m[3] ? ' = ' + tExpr(m[3], x) : ''}` };
  });
  rule(/^use the shared\s+(.+)$/i, (m, x) => {
    const names = splitItems(m[1]).map(n => toName(n, x));
    if (x.fn) names.forEach(n => (x.fn.explicit = x.fn.explicit || new Set()).add(n));
    x.note('`global` lets this tool change a value that lives outside it, instead of making its own copy.');
    return { py: `global ${names.join(', ')}` };
  });
  rule(/^delete\s+(?!.*\sfrom\s)(.+)$/i, (m, x) => {   // "delete … from …" is the remove sentence below
    const parts = splitItems(m[1]).map(t => tExpr(t, x));
    x.note('`del` removes a name, or an item from a list or dictionary.');
    return { py: `del ${parts.join(', ')}` };
  });

  // --- Handling errors ---------------------------------------------------
  rule(/^try$/i, (m, x) => {
    x.note('`try` runs the indented lines and watches for errors. What to do if one happens goes in "if it fails".');
    return { py: 'try:', open: 'block', tag: 'try' };
  });
  rule(/^(?:if|when) (?:it|that|this|anything|something) fails(?:\s+with\s+(.+?))?(?:\s+as\s+([A-Za-z_]\w*))?$/i, (m, x) => {
    let kinds = m[1] ? splitItems(m[1].replace(/\s+or\s+/gi, ', ')).map(k => tExpr(k, x)) : [];
    const type = kinds.length > 1 ? `(${kinds.join(', ')})` : kinds[0] || '';
    if (m[2]) declare(x, m[2], m[2], 'value');
    x.note(m[1] ? `\`except\` catches ${kinds.map(code).join(' or ')} errors from the \`try\` block, so the program carries on instead of stopping.` : 'A bare `except` catches every kind of error. That can hide real problems; naming the error is safer.');
    return { py: `except${type ? ' ' + type : ''}${m[2] ? ' as ' + m[2] : ''}:`, open: 'block', tag: 'except' };
  });
  rule(/^if nothing failed$/i, (m, x) => {
    x.note('This `else` runs only when the `try` block finished without an error.');
    return { py: 'else:', open: 'block', tag: 'tryelse' };
  });
  rule(/^(?:finally|in any case|either way|whatever happens)$/i, (m, x) => {
    x.note('`finally` always runs, error or not. It is used for clean-up, like closing files.');
    return { py: 'finally:', open: 'block', tag: 'finally' };
  });
  rule(/^fail again$/i, (m, x) => {
    x.note('A bare `raise` passes the error that was just caught on up to whoever ran this.');
    return { py: 'raise' };
  });
  rule(/^(?:fail|stop) with\s+(?:(?:the|an?)\s+)?(?:error\s+)?([A-Za-z_][\w.]*)(?:\s*:\s*(.+))?$/i, (m, x) => {
    x.note(`\`raise\` stops with a ${code(m[1])} error. Whoever ran this can catch it with "if it fails".`);
    return { py: `raise ${m[1]}${m[2] ? `(${splitItems(m[2]).map(a => tExpr(a, x)).join(', ')})` : ''}` };
  });
  rule(/^check that\s+(.+)$/i, (m, x) => {
    x.note('`assert` stops the program with an error if the check is false. Tests are made of these.');
    return { py: `assert ${tExpr(m[1], x, { cond: true })}` };
  });

  // --- Files and other things that need closing ----------------------------
  rule(/^open\s+(?:the\s+)?(?:file\s+)?(.+?)(?:\s+for\s+(reading|writing|adding|appending))?\s+as\s+([A-Za-z_]\w*)$/i, (m, x) => {
    const mode = { reading: 'r', writing: 'w', adding: 'a', appending: 'a' }[(m[2] || '').toLowerCase()];
    declare(x, m[3], m[3], 'value');
    x.note(`\`with open(…)\` opens the file and closes it automatically when the indented lines finish.` + (mode === 'w' ? ' Writing replaces whatever was in the file.' : mode === 'a' ? ' Adding writes to the end and keeps what was there.' : ''));
    return { py: `with open(${tExpr(m[1], x)}${mode ? `, "${mode}"` : ''}) as ${m[3]}:`, open: 'block' };
  });
  rule(/^(async\s+)?using\s+(.+?)(?:\s+as\s+([A-Za-z_]\w*))?$/i, (m, x) => {
    if (m[3]) declare(x, m[3], m[3], 'value');
    x.note('`with` sets something up for the indented lines and tidies it away afterwards, even if there is an error.');
    return { py: `${m[1] ? 'async ' : ''}with ${tExpr(m[2], x)}${m[3] ? ' as ' + m[3] : ''}:`, open: 'block' };
  });

  // --- Tools (functions) -----------------------------------------------
  rule(/^(?:define|create (?:a )?(?:new )?(?:tool|function)|make (?:a )?(?:new )?(?:tool|function)|new tool)\s+(async\s+)?(?:called\s+|named\s+)?(.+?)(?:\s+(?:using|with|that takes|taking|needing|given)\s+(.+))?$/i, (m, x) => {
    const name = toName(m[2], x, { define: true });
    const parts = m[3] && !/^nothing$/i.test(m[3].trim()) ? splitItems(m[3]) : [];
    const params = [], shown = [];
    for (const p of parts) {
      const d = p.match(/^([A-Za-z_]\w*)\s*(?::\s*(.+?))?\s*(?:=\s*(.+))?$/) || [null, p];
      const pn = toName(d[1], x, { define: true });
      params.push(pn);
      shown.push(pn + (d[2] ? `: ${tExpr(d[2], x)}` : '') + (d[3] ? (d[2] ? ' = ' : '=') + tExpr(d[3], x) : ''));
    }
    const required = parts.filter(p => !/=(?!=)/.test(p)).length;
    declare(x, name, m[2], 'function', { params, required });
    for (const p of params) declare(x, p, p, 'value', { scope: 'local' });
    if (x.level > 0 && !x.inside('class')) x.warn('This tool is defined inside another block. Usually tools are defined at the left edge, with nothing in front.');
    x.note(`${code(m[1] ? 'async def' : 'def')} makes a reusable tool called ${code(name)}. The indented lines under it only run when you "run ${m[2].trim()}".` + (params.length ? ` Its inputs (${params.map(code).join(', ')}) are filled in each time it runs.` : '') + (required < params.length ? ' Inputs with `=` have a value to use if none is given.' : '') + (m[1] ? ' `async` means it can wait for slow things (like the internet) without blocking.' : ''));
    return { py: `${m[1] ? 'async ' : ''}def ${name}(${shown.join(', ')}):`, open: 'def', fn: { name, params } };
  });

  rule(/^(?:give back|return|send back|answer with|hand back)\b\s*(.*)$/i, (m, x) => {
    if (!x.inside('def')) x.err('"give back" only works inside a tool (a define block). It hands a result back to whoever ran the tool.');
    x.note('`return` ends the tool and hands this value back to the line that ran it.');
    return { py: m[1] ? `return ${tExpr(m[1], x)}` : 'return', tag: 'return' };
  });

  // --- Decisions --------------------------------------------------------
  rule(/^(?:otherwise if|else if|elif|or else if|otherwise when)\s+(.+)$/i, (m, x) => {
    x.note('`elif` ("else if") is only checked when everything above it was false.');
    return { py: `elif ${tExpr(m[1], x, { cond: true })}:`, open: 'if', tag: 'elif' };
  });
  rule(/^(?:otherwise|else|or else|if not)$/i, (m, x) => {
    x.note('`else` runs when none of the conditions above were true.');
    return { py: 'else:', open: 'if', tag: 'else' };
  });
  rule(/^(?:if|when)\s+(.+)$/i, (m, x) => {
    return { py: `if ${tExpr(m[1], x, { cond: true })}:`, open: 'if', tag: 'if' };
  });

  // --- Loops ------------------------------------------------------------
  rule(/^(?:repeat forever|forever|keep repeating|loop forever|keep going|repeat)$/i, (m, x) => {
    x.note('`while True` repeats forever. Use "stop the loop" inside it to get out.');
    return { py: 'while True:', open: 'loop' };
  });
  rule(/^(?:repeat until|keep (?:going|repeating) until|until|do until|loop until)\s+(.+)$/i, (m, x) => {
    const c = tExpr(m[1], x, { cond: true });
    x.note('Python has no "until" loop, so it becomes `while not …`: keep going while the condition is still false.');
    return { py: /^[\w.()[\]]+$/.test(c) ? `while not ${c}:` : `while not (${c}):`, open: 'loop' };
  });
  rule(/^(?:while|repeat while|keep (?:going|repeating) while|as long as|loop while)\s+(.+)$/i, (m, x) => {
    x.note('`while` checks the condition before every round. If it never becomes false, the loop never ends.');
    return { py: `while ${tExpr(m[1], x, { cond: true })}:`, open: 'loop' };
  });
  rule(/^(?:repeat|do this|do it|loop)\s+(once|twice|thrice)$/i, (m, x) => {
    const n = { once: 1, twice: 2, thrice: 3 }[m[1].toLowerCase()];
    x.note('`range(n)` gives n rounds. `_` is the name Python programmers use for a counter they don\'t need.');
    return { py: `for _ in range(${n}):`, open: 'loop' };
  });
  rule(/^(?:repeat|do this|do it|loop)\s+(.+?)\s+times?(?:\s+(?:counting with|counting|using|with|as)\s+(.+))?$/i, (m, x) => {
    const n = tExpr(m[1], x);
    if (m[2]) {
      const v = toName(m[2], x, { define: true });
      declare(x, v, m[2], 'number');
      x.note(`${code('range(' + n + ')')} counts 0, 1, 2 … up to one less than ${n}. ${code(v)} holds the current count.`);
      return { py: `for ${v} in range(${n}):`, open: 'loop' };
    }
    x.note(`${code('range(' + n + ')')} gives ${n} rounds. \`_\` is the name Python programmers use for a counter they don't need.`);
    return { py: `for _ in range(${n}):`, open: 'loop' };
  });
  rule(/^(?:count(?: down| up)?|for)(?:\s+(.+?))?\s+from\s+(.+?)\s+(down\s+)?to\s+(.+?)(?:\s+(?:in steps of|by|step|stepping by)\s+(.+))?$/i, (m, x) => {
    if (!m[1] || /^(?:down|up)$/i.test(m[1])) {
      m[1] = 'n';
      x.note('No name was given for the count, so it is called `n`. Write "count i from …" to choose a name.');
    }
    const v = toName(m[1], x, { define: true });
    declare(x, v, m[1], 'number');
    const a = tExpr(m[2], x), b = tExpr(m[4], x);
    const step = m[5] ? tExpr(m[5], x) : null;
    const down = !!m[3] || /^count down/i.test(m.input) || (isNum(a) && isNum(b) && +a > +b);
    let end, st = step;
    if (down) {
      end = isNum(b) ? String(+b - 1) : `${b} - 1`;
      st = step ? (isNum(step) ? String(-Math.abs(+step)) : `-${step}`) : '-1';
      x.note(`Counting down: \`range(start, end, -1)\` stops just before its end, so the translator uses ${code(end)} to include ${b}.`);
    } else {
      end = isNum(b) ? String(+b + 1) : `${b} + 1`;
      x.note(`\`range(start, end)\` stops just before its end number, so the translator uses ${code(end)} to include ${b}.`);
    }
    return { py: `for ${v} in range(${a}, ${end}${st ? ', ' + st : ''}):`, open: 'loop' };
  });
  rule(/^(?:for each|for every|go through each|go through every|with each|for)\s+(.+?)\s+(?:in|of|from)\s+(.+)$/i, (m, x) => {
    const coll = tExpr(m[2], x);
    const names = splitItems(m[1]);
    if (names.length > 1) {
      const vs = names.map(n => toName(n, x, { define: true }));
      vs.forEach(v => declare(x, v, v, 'value'));
      x.note(`Each item is a group of ${vs.length} values, so each round they are unpacked into ${vs.map(code).join(', ')}.`);
      return { py: `for ${vs.join(', ')} in ${coll}:`, open: 'loop' };
    }
    const v = toName(m[1], x, { define: true });
    const ck = x.syms.get(coll)?.kind;
    declare(x, v, m[1], ck === 'text' ? 'text' : 'value');
    x.note(`Takes the items of ${code(coll)} one at a time. Each round, ${code(v)} holds the current one.` + (ck === 'text' ? ' For text, that means one letter at a time.' : ck === 'dict' ? ' For a dictionary, that means each key.' : ''));
    return { py: `for ${v} in ${coll}:`, open: 'loop' };
  });
  rule(/^(?:stop the loop|stop looping|stop repeating|stop loop|exit the loop|leave the loop|break(?: out)?(?: of the loop)?)$/i, (m, x) => {
    if (!x.inside('loop')) x.err('"stop the loop" only works inside a loop (repeat, while, for each or count).');
    x.note('`break` jumps straight out of the nearest loop.');
    return { py: 'break' };
  });
  rule(/^(?:skip to (?:the )?next(?: one| round| item)?|skip the rest|next round|continue)$/i, (m, x) => {
    if (!x.inside('loop')) x.err('"skip to next" only works inside a loop.');
    x.note('`continue` skips the rest of this round and starts the next one.');
    return { py: 'continue' };
  });
  rule(/^(?:do nothing|nothing|pass)$/i, (m, x) => {
    x.note('`pass` does nothing. Python needs at least one line inside every block, so this fills the gap.');
    return { py: 'pass' };
  });
  rule(/^(?:stop the program|end the program|quit|exit(?: the program)?)$/i, (m, x) => {
    x.use('sys');
    x.note('`sys.exit()` stops the whole program immediately.');
    return { py: 'sys.exit()' };
  });

  // --- Showing and asking -------------------------------------------------
  rule(/^(?:show|print|say|display) (?:nothing|a blank line|an empty line|a new line|blank)$/i, (m, x) => {
    x.note('`print()` with nothing inside prints an empty line.');
    return { py: 'print()' };
  });
  rule(/^(?:show|print|display|say|write|output)\s+(.+?)(\s+(?:on the same line|without (?:a )?new ?line|and stay on this line))?$/i, (m, x) => {
    const items = splitItems(m[1]).map(p => tExpr(p, x));
    if (items.length > 1) x.note('Several things separated by "and" or commas are shown on one line, with a space between each.');
    if (m[2]) x.note('`end=" "` stops `print` moving to a new line, so the next thing shown continues on this line.');
    return { py: `print(${items.join(', ')}${m[2] ? ', end=" "' : ''})` };
  });
  rule(/^ask(?:\s+(?:for|the user for|them for))?(?:\s+(?:an?\s+)?(whole number|number|decimal(?: number)?|text|word|answer|name))?(?:\s+(.+?))?\s+(?:and\s+)?(?:store|save|keep|put|remember)(?:\s+(?:it|that|the answer|the reply))?\s+(?:in|as|into)\s+(.+)$/i, (m, x) => {
    const kindWord = (m[1] || '').toLowerCase();
    const prompt = m[2] ? tExpr(m[2], x) : '';
    const name = toName(m[3], x, { define: true });
    let py = `input(${prompt})`, kind = 'text';
    if (/number/.test(kindWord) && !/decimal/.test(kindWord)) {
      py = `int(${py})`; kind = 'number';
      x.note('`input()` always gives back text. `int()` turns it into a whole number so you can do maths or compare it. If someone types letters, the program stops with an error.');
    } else if (/decimal/.test(kindWord)) {
      py = `float(${py})`; kind = 'number';
      x.note('`input()` always gives back text. `float()` turns it into a decimal number.');
    } else {
      x.note('`input()` shows the question, waits for the person to type, and gives back what they typed, always as text. Use "ask for a number" if you need a number.');
    }
    if (m[2] && !/^f?["']/.test(prompt)) x.warn('The question usually goes in quotes, like ask "What is your name? " and store in name.');
    declare(x, name, m[3], kind);
    assigned(x, name);
    return { py: `${name} = ${py}` };
  });
  rule(/^ask\s+(.+)$/i, (m, x) => {
    x.warn('The answer isn\'t stored anywhere. Add "and store in ‹name›" to keep it.');
    return { py: `input(${tExpr(m[1], x)})` };
  });

  // --- Lists and dictionaries ---------------------------------------------
  rule(/^(?:create|make|start)\s+(?:an?\s+)?(?:new\s+)?(empty\s+)?list\s+(?:called\s+|named\s+)?(.+?)(?:\s+(?:with|containing|holding|of)\s+(.+))?$/i, (m, x) => {
    const name = toName(m[2], x, { define: true });
    const items = m[3] ? splitItems(m[3]).map(p => tExpr(p, x)) : [];
    declare(x, name, m[2], 'list');
    assigned(x, name);
    x.note(`A list keeps several values in order, inside square brackets.` + (items.length ? ` Positions start at 0, so ${code(name + '[0]')} is ${items[0]}.` : ' This one starts empty.'));
    return { py: `${name} = [${items.join(', ')}]` };
  });
  rule(/^(?:create|make|start)\s+(?:an?\s+)?(?:new\s+)?(?:empty\s+)?(?:dictionary|dict|lookup table|lookup)\s+(?:called\s+|named\s+)?(.+)$/i, (m, x) => {
    const name = toName(m[1], x, { define: true });
    declare(x, name, m[1], 'dict');
    assigned(x, name);
    x.note('A dictionary stores values under keys, like a word and its meaning. Add to it with: set item "key" of ' + name + ' to value.');
    return { py: `${name} = {}` };
  });
  rule(/^(?:add|append|put)\s+(.+?)\s+(?:to|onto|into)\s+(?:the\s+end\s+of\s+)?(.+)$/i, (m, x) => {
    const val = tExpr(m[1], x);
    const target = tExpr(m[2], x);
    const s = x.syms.get(target);
    if (x.pass === 2 && !s) { x.err(`${code(target)} doesn't exist yet. Create it first, e.g. "set ${m[2].trim()} to 0" or "create list ${m[2].trim()}".`); }
    const k = s?.kind;
    if (k === 'list') {
      x.note(`${code(target)} is a list, so "add" puts ${code(val)} on the end with ${code('.append()')}.`);
      return { py: `${target}.append(${val})` };
    }
    if (k === 'dict') { x.err('To add to a dictionary, give the key: set item "key" of ' + target + ' to value.'); return { py: `${target}` }; }
    assigned(x, target);
    if (k === 'text') x.note(`${code(target)} is text, so "add" joins ${code(val)} onto the end. \`+=\` is short for ${code(target + ' = ' + target + ' + ' + val)}.`);
    else x.note(`${code(target)} is ${KIND_WORDS[k] || 'a value'}, so "add" increases it with \`+=\` (short for ${code(target + ' = ' + target + ' + ' + val)}). If it were a list, this would use \`.append()\` instead.`);
    return { py: `${target} += ${val}` };
  });
  rule(/^(?:remove|delete)\s+(.+?)\s+from\s+(.+)$/i, (m, x) => {
    const target = tExpr(m[2], x);
    const k = x.syms.get(target)?.kind;
    if (k === 'dict') {
      const key = tExpr(m[1], x);
      x.note(`\`del\` removes the key ${code(key)} and its value from the dictionary.`);
      return { py: `del ${target}[${key}]` };
    }
    const it = m[1].match(/^(?:the\s+)?item\s+(.+)$/i);
    if (k === 'list' && it) {
      const pos = tExpr(it[1], x);
      x.note(`\`.pop(${pos})\` removes the item at position ${pos}. Positions start at 0.`);
      return { py: `${target}.pop(${pos})` };
    }
    const val = tExpr(m[1], x);
    if (k === 'list') {
      x.note('`.remove()` takes out the first matching item. If it isn\'t in the list, Python stops with an error, so you might check with "if … is in …" first.');
      return { py: `${target}.remove(${val})` };
    }
    assigned(x, target);
    x.note(`${code(target)} is ${KIND_WORDS[k] || 'a value'}, so "remove" subtracts with \`-=\`.`);
    return { py: `${target} -= ${val}` };
  });
  rule(/^(?:subtract|take away|take)\s+(.+?)\s+from\s+(.+)$/i, (m, x) => {
    const target = tExpr(m[2], x); assigned(x, target);
    x.note(`\`-=\` is short for ${code(target + ' = ' + target + ' - …')}.`);
    return { py: `${target} -= ${tExpr(m[1], x)}` };
  });
  rule(/^(?:increase|raise|increment|bump up|go up)\s+(.+?)(?:\s+by\s+(.+))?$/i, (m, x) => {
    const target = tExpr(m[1], x); assigned(x, target);
    const by = m[2] ? tExpr(m[2], x) : '1';
    if (!m[2]) x.note('No amount given, so it goes up by 1.');
    x.note(`\`+=\` is short for ${code(target + ' = ' + target + ' + ' + by)}.`);
    return { py: `${target} += ${by}` };
  });
  rule(/^(?:decrease|lower|reduce|decrement|go down)\s+(.+?)(?:\s+by\s+(.+))?$/i, (m, x) => {
    const target = tExpr(m[1], x); assigned(x, target);
    const by = m[2] ? tExpr(m[2], x) : '1';
    if (!m[2]) x.note('No amount given, so it goes down by 1.');
    x.note(`\`-=\` is short for ${code(target + ' = ' + target + ' - ' + by)}.`);
    return { py: `${target} -= ${by}` };
  });
  rule(/^multiply\s+(.+?)\s+by\s+(.+)$/i, (m, x) => {
    const t = tExpr(m[1], x); assigned(x, t);
    return { py: `${t} *= ${tExpr(m[2], x)}` };
  });
  rule(/^divide\s+(.+?)\s+by\s+(.+)$/i, (m, x) => {
    const t = tExpr(m[1], x); assigned(x, t);
    x.note('`/=` divides and always leaves a decimal number, even 10 / 2 gives 5.0.');
    return { py: `${t} /= ${tExpr(m[2], x)}` };
  });
  rule(/^(sort|reverse|shuffle|empty|clear)\s+(.+?)(\s+(?:backwards|in reverse|biggest first|largest first|highest first|descending))?$/i, (m, x) => {
    const verb = m[1].toLowerCase();
    const t = tExpr(m[2], x);
    if (x.pass === 2 && x.syms.get(t) && !['list', 'value', 'dict'].includes(x.syms.get(t).kind)) x.warn(`${code(t)} doesn't look like a list.`);
    if (verb === 'sort') {
      x.note(m[3] ? '`.sort(reverse=True)` sorts the list in place, biggest first.' : '`.sort()` changes the list itself into order: smallest first, or A to Z.');
      return { py: `${t}.sort(${m[3] ? 'reverse=True' : ''})` };
    }
    if (verb === 'reverse') return { py: `${t}.reverse()` };
    if (verb === 'shuffle') { x.use('random'); x.note('`random.shuffle` mixes up the list in place.'); return { py: `random.shuffle(${t})` }; }
    x.note('`.clear()` removes everything, leaving it empty.');
    return { py: `${t}.clear()` };
  });

  // --- Time ----------------------------------------------------------------
  rule(/^(?:wait|pause|sleep)\s+(?:for\s+)?(.+?)(?:\s+(?:seconds?|secs?)|(?<=\d)\s*s)$/i, (m, x) => {
    x.use('time');
    x.note('`time.sleep()` pauses the program. (In this browser preview pauses are skipped, so output appears all at once.)');
    return { py: `time.sleep(${tExpr(m[1], x)})` };
  });

  // --- Objects ---------------------------------------------------------------
  rule(/^(?:make|create)\s+(?:a\s+)?new\s+([A-Za-z_][\w.]*)(?:\s+(?:with|using|from)\s+(.+?))?\s+and\s+(?:store|keep|save|put)(?:\s+it)?\s+(?:in|as|into)\s+(.+)$/i, (m, x) => {
    const call = callExpr(m[1], m[2], x);
    const v = toName(m[3], x, { define: true });
    declare(x, v, m[3], 'value'); assigned(x, v);
    x.note(`Makes a new ${code(m[1])} object and stores it in ${code(v)}. Python writes this as a call, like running a tool.`);
    return { py: `${v} = ${call}` };
  });

  // --- Storing -------------------------------------------------------------
  rule(/^(?:set|make|let|change|update)\s+(.+?)\s+(?:to be|to|be|equal to|equal|=)\s+(.+)$/i, (m, x) => doSet(m[1], m[2], x));
  rule(/^(?:remember|store|save|keep)\s+(.+?)\s+(?:as|in|into)\s+(.+)$/i, (m, x) => doSet(m[2], m[1], x));

  // --- Running tools ---------------------------------------------------------
  rule(/^(?:run|call|do|use|perform)\s+(?:the\s+)?(?:tool\s+)?(.+?)(?:\s+(?:with|using|on|for)\s+(.+?))?(?:\s+and\s+(?:store|save|keep|put|remember)(?:\s+(?:it|the result|the answer|what it gives back))?\s+(?:in|as|into)\s+(.+))?$/i, (m, x) => {
    const call = callExpr(m[1], m[2], x);
    if (m[3]) {
      const v = toName(m[3], x, { define: true });
      declare(x, v, m[3], 'value'); assigned(x, v);
      x.note(`Runs the tool and stores whatever it gives back in ${code(v)}.`);
      return { py: `${v} = ${call}` };
    }
    x.note('Runs the tool. If it gives something back and you want to keep it, add "and store in ‹name›".');
    return { py: call };
  });

  // --- Already Python -----------------------------------------------------------
  rule(/^([A-Za-z_]\w*)\s*([+\-*/]?=)(?!=)\s*(.+)$/, (m, x) => {
    const py = x.syms.has(m[1]) ? x.syms.get(m[1]).py : m[1];
    if (m[2] === '=') declare(x, py, py, kindOf(tExpr(m[3], x), x));
    assigned(x, py);
    x.note('This is already Python, so it is kept almost as written.');
    return { py: `${py} ${m[2]} ${tExpr(m[3], x)}` };
  });

  const STARTERS = ['set', 'show', 'ask', 'if', 'otherwise', 'repeat', 'while', 'count', 'for each', 'define', 'give back', 'run', 'add', 'remove', 'increase', 'decrease', 'create list', 'sort', 'wait', 'note', 'python', 'stop the loop', 'skip to next', 'multiply', 'divide', 'remember', 'use'];

  /* ------------------------------------------------------------------ */
  /* Filler words, and several steps in one sentence                     */
  /* ------------------------------------------------------------------ */

  // Natural phrasing is never penalised: these words are left out, and the explain strip says so.
  const LEAD_FILLER = /^(?:(?:please|kindly|ok|okay|so|and|now|next|then|and then|also|just|simply|finally|first(?:ly)?|after that|afterwards|i want to|i'd like to|i would like to|i need to|we need to|we want to|let's|let us|can you|could you|you should|go ahead and|make sure (?:to|you)|try to|remember to|be sure to)\s*,?\s+)+/i;
  const ANY_FILLER = /\b(?:please|kindly|just|simply|basically|really|actually|quickly)\b/gi;
  const TAIL_FILLER = /(?:\s*,?\s*\b(?:please|for me|thanks|thank you))+\s*[.!]?\s*$/i;
  const STEP_SPLIT = /\s*;\s*|\s*,?\s+(?:and then|then|after that|afterwards)\s+/gi;
  // A colon splits "repeat 3 times: show hi" only when a lower-case sentence follows (so "note: Note" types stay put).
  const STEP_START = /^(?:show|print|say|display|set|ask|run|call|give back|return|add|remove|delete|increase|decrease|multiply|divide|stop|skip|do nothing|wait|create|make|if|repeat|for each|count|fail|check|open|using|sort|shuffle|reverse)\b(?!\s*[:=(.\[])/;
  const NOT_FILLER = /^(?:next round|then|now|next|first)$/i;   // sentences that happen to start like filler

  // Hide quoted text (same length) so word matching never touches it.
  const mask = (s) => s.replace(/"(?:[^"\\]|\\.)*"?|(?<![A-Za-z0-9_])[rRbBuUfF]{0,2}'(?:[^'\\]|\\.)*'?/g, (m) => '\u0001'.repeat(m.length));
  const balanced = (s) => { let d = 0; for (const c of s) { if ('([{'.includes(c)) d++; else if (')]}'.includes(c)) d--; } return d === 0; };

  function stripFiller(s) {
    const removed = [];
    if (NOT_FILLER.test(s) || /^[A-Za-z_]\w*\s*[+\-*/]?=[^=]/.test(s)) return { text: s, removed };
    const lead = s.match(LEAD_FILLER);
    if (lead && lead[0].length < s.length) { removed.push(lead[0].replace(/,/g, ' ').replace(/\s+/g, ' ').trim()); s = s.slice(lead[0].length); }
    const tail = mask(s).match(TAIL_FILLER);
    if (tail && tail.index > 0) { removed.push(...tail[0].replace(/[.!,]/g, ' ').trim().split(/\s+(?=please|for|thanks|thank)/i)); s = s.slice(0, tail.index); }
    let out = '', last = 0;
    for (const m of mask(s).matchAll(ANY_FILLER)) { out += s.slice(last, m.index); last = m.index + m[0].length; removed.push(m[0].toLowerCase()); }
    s = out + s.slice(last);
    // tidy double spaces left by removed words, but never inside quoted text
    if (removed.length) {
      const m = mask(s);
      let tidy = '';
      for (let i = 0; i < s.length; i++) if (!(s[i] === ' ' && m[i] !== '\u0001' && s[i + 1] === ' ' && m[i + 1] !== '\u0001')) tidy += s[i];
      s = tidy;
    }
    return { text: s.trim(), removed: removed.map(w => w.toLowerCase()) };
  }

  function splitSteps(s) {
    const parts = []; let last = 0;
    for (const m of mask(s).matchAll(STEP_SPLIT)) { parts.push(s.slice(last, m.index)); last = m.index + m[0].length; }
    parts.push(s.slice(last));
    const clean = parts.map(p => p.trim()).filter(Boolean);
    // "repeat 3 times: show hi" -> header + body
    if (clean.length) {
      const c = mask(clean[0]).search(/:\s+\S/);
      const after = clean[0].slice(c + 1).trim();
      if (c > 0 && OPENS_BLOCK.test(clean[0].slice(0, c)) && balanced(mask(clean[0].slice(0, c))) && STEP_START.test(after)) clean.splice(0, 1, clean[0].slice(0, c), clean[0].slice(c + 1).trim());
    }
    return clean;
  }

  function tLine(text, x) {
    const s0 = text.trim();
    // raw Python, notes and descriptions are never touched (raw Python keeps any spaces at its end)
    for (const r of RULES.slice(0, 3)) {
      const m = (r === RULES[0] ? text.replace(/^\s+/, '').replace(/\r$/, '') : s0).match(r.re);
      if (m) return r.fn(m, x);
    }
    const { text: s, removed } = stripFiller(s0);
    const parts = splitSteps(s);
    const said = [...new Set(removed)];
    const fillerNote = () => { if (said.length) x.note(`Left out filler: ${said.map(w => '"' + w + '"').join(', ')}. You can write words like these; Python doesn't need them.`); };
    if (!parts.length) { x.err('This line only has filler words in it. Say what should happen, for example: show "hello".'); return { py: '# ??? ' + s0 }; }
    if (parts.length === 1) { const r = tOne(parts[0], x); fillerNote(); return r; }

    // Several steps: each becomes its own line. Steps after a block header go inside it.
    const pys = [], results = [];
    let depth = 0, pushed = 0;
    parts.forEach((p, i) => {
      const r = tOne(p, x);
      results.push(r);
      pys.push('    '.repeat(depth) + r.py);
      if (r.open && i < parts.length - 1) { depth++; x.stack.push({ ind: -1, type: r.open }); pushed++; }
    });
    for (; pushed > 0; pushed--) x.stack.pop();
    const last = results[results.length - 1];
    if (last.open && depth > 0) x.err('Only one block can be opened in a sentence like this. Put the second block on its own line.');
    fillerNote();
    x.note(`This sentence has ${parts.length} steps, so it becomes ${parts.length} lines of Python.` + (depth ? ' The steps after the first are indented because they belong to it.' : ''));
    return { py: pys[0], pys, open: depth ? null : last.open, tag: depth ? results[0].tag : last.tag, fn: depth ? undefined : last.fn };
  }

  function tOne(text, x) {
    let s = text.trim();
    s = s.replace(/\s*:\s*$/, '')
      .replace(/(?<![\d.])\.\s*$/, '')
      .replace(/\s+(?:then|do)$/i, '');
    for (const r of RULES.slice(3)) {
      const m = qmatch(s, r.re);
      if (m) { const res = r.fn(m, x); if (res) return res; }
    }
    // Fallback: a bare call like print("hi") or greet(name) is fine as-is.
    const e = tExpr(s, x);
    if (/^(?:await\s+)?[\w.]+\(.*\)$/.test(e) && !x.info.errs.length) {
      x.note('This looks like Python already, so it is kept as written.');
      return { py: e };
    }
    x.info.errs.length = 0; x.info.warns.length = 0; x.info.notes.length = 0;
    const first = s.split(/\s+/)[0].toLowerCase();
    const guess = closest(first, STARTERS.map(w => w.split(' ')[0]), 2);
    x.err(`I don't recognise this sentence.` + (guess && guess !== first ? ` Did you mean "${guess}"?` : '') + ' Open the Index to see the sentences you can use, or start the line with python: to write Python directly.');
    return { py: '# ??? ' + s };
  }

  /* ------------------------------------------------------------------ */
  /* A whole section (file)                                              */
  /* ------------------------------------------------------------------ */

  function sectionTitle(file) {
    return { settings: 'Settings', tools: 'Tools', main: 'Main program' }[file] || file;
  }

  function translateSection(sec, env, project) {
    const lines = sec.text.split('\n');
    const out = [];
    const info = lines.map((_, i) => ({ line: i, py: [], notes: [], warns: [], errs: [] }));
    const stack = [{ ind: 0, type: 'root' }];
    const lastTag = [];
    env.imports = new Set();
    let pending = null;
    const fnRecords = [];

    const closeBlock = (entry) => {
      if (entry.empty) {   // only notes inside: Python still needs a line there
        let at = out.length;
        while (at > 0 && !out[at - 1].text.trim()) at--;
        out.splice(at, 0, { text: ' '.repeat(entry.level * 4) + 'pass', src: entry.head, extra: true });
        const n = 'Only notes are indented under this line, and Python needs at least one real line in every block, so `pass` (do nothing) is added after them.';
        if (!info[entry.head].notes.includes(n)) info[entry.head].notes.push(n);
      }
      const auto = entry.fn ? [...entry.fn.globals].filter(g => !(entry.fn.explicit && entry.fn.explicit.has(g))) : [];
      if (auto.length && env.pass === 2) {
        out.splice(entry.fn.outIdx + 1, 0, { text: ' '.repeat((entry.fn.level + 1) * 4) + 'global ' + auto.join(', '), src: entry.fn.line, extra: true });
      }
    };
    const isDesc = (j, ind) => j >= 0 && j < lines.length && /^\s*description\s*:/i.test(lines[j]) && lines[j].replace(/\t/g, '    ').match(/^ */)[0].length === ind;
    let strOpen = null;   // a python: line left text in triple quotes open: { delim, line }
    let seenCode = false, docEnd = 0;   // the imports added at the top go after the file's description

    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i].replace(/\t/g, '    ');
      const cur = info[i];
      if (!rawLine.trim()) { out.push({ text: '', src: i }); continue; }
      const ind = rawLine.match(/^ */)[0].length;

      // the rest of a text in triple quotes: copied exactly, spaces and all
      if (strOpen) {
        const c = lines[i].match(/^\s*(?:raw python|python|raw)\s*:\s?(.*?)\r?$/i);
        if (c) {
          out.push({ text: c[1], src: i });
          strOpen.delim = openString(c[1], strOpen.delim);
          cur.notes.push(`Part of the text in triple quotes that starts on line ${strOpen.line + 1}, copied exactly.`);
          if (!strOpen.delim) strOpen = null;
          continue;
        }
        info[strOpen.line].errs.push(`The text in triple quotes that starts here isn't closed. Its next lines must be python: lines, ending with ${strOpen.delim}.`);
        strOpen = null;
      }

      let top = stack[stack.length - 1];
      let pushed = false, popped = false, badIndent = false;
      if (pending) {
        if (ind > top.ind) { stack.push({ ind, type: pending.type, fn: pending.fn, empty: true, head: pending.line, level: stack.length }); pushed = true; }
        else {
          info[pending.line].errs.push('Nothing is indented under this line. The lines that belong to it need to move right: press Tab at the start of the next line.');
          out.splice(pending.outIdx + 1, 0, { text: ' '.repeat((pending.level + 1) * 4) + 'pass', src: pending.line, extra: true });
        }
        pending = null;
      } else if (ind > top.ind) {
        cur.errs.push("This line is indented, but the line above doesn't start a block (like if, repeat or define). Move it back left with Shift+Tab.");
        badIndent = true;
      }
      while (stack.length > 1 && ind < stack[stack.length - 1].ind) {
        const e = stack.pop(); closeBlock(e); popped = true;
        lastTag.length = stack.length;
      }
      top = stack[stack.length - 1];
      if (popped && ind !== top.ind) cur.errs.push("This line's indentation doesn't line up with any line above it.");
      const level = stack.length - 1;
      lastTag.length = level + 1;

      const fnEntry = [...stack].reverse().find(e => e.fn);
      const x = makeCtx(env, sec.file, cur, { stack, fn: fnEntry ? fnEntry.fn : null, level });
      let res;
      try { res = tLine(rawLine, x); }
      catch (err) { cur.errs.push('The translator got stuck on this line: ' + err.message); res = { py: '# ??? ' + rawLine.trim() }; }

      if (res.tag === 'elif' || res.tag === 'else') {
        if (!['if', 'elif'].includes(lastTag[level])) {
          cur.errs.push(`"${rawLine.trim().split(/\s+/).slice(0, res.tag === 'elif' ? 2 : 1).join(' ')}" needs an "if" right above it, lined up at the same indentation.`);
        }
      }
      if (['except', 'tryelse', 'finally'].includes(res.tag) && !['try', 'except', 'tryelse'].includes(lastTag[level])) {
        cur.errs.push('This belongs to a "try" block: put it right after the lines under "try", lined up with the word "try".');
      }
      if (lastTag[level] === 'decorator' && !/^(?:@|def |async def |class )/.test(res.py || '')) {
        cur.errs.push('The line above (a decorator or web route) must be followed by "define …" or "define class …".');
      }
      if (!res.comment) { lastTag[level] = res.tag || 'stmt'; for (const e of stack) e.empty = false; }

      if (res.desc != null) {   // description lines in a row make one text in triple quotes
        const first = !isDesc(i - 1, ind), last = !isDesc(i + 1, ind), t = res.desc;
        if (!first && !last && !t) out.push({ text: '', src: i });
        else out.push({ text: ' '.repeat(level * 4) + (first ? '"""' + t + (last ? '"""' : '') : t + (last ? '"""' : '')), src: i });
        if (last && !seenCode) { seenCode = true; if (level === 0) docEnd = out.length; }   // the file's own description stays first
        continue;
      }
      if (!res.comment) seenCode = true;
      for (const p of res.pys || [res.py]) out.push({ text: ' '.repeat(level * 4) + p, src: i });
      if (res.strOpen) strOpen = { delim: res.strOpen, line: i };
      if (res.open) {
        const fn = res.fn ? { ...res.fn, outIdx: out.length - 1, level, line: i, locals: new Set(res.fn.params), globals: new Set() } : null;
        if (fn) fnRecords.push(fn);
        pending = { line: i, type: res.open, level, outIdx: out.length - 1, fn };
      }
    }
    if (strOpen) info[strOpen.line].errs.push(`The text in triple quotes that starts here isn't closed: end it with ${strOpen.delim}.`);
    if (pending) {
      info[pending.line].errs.push('Nothing is indented under this line. Add at least one indented line below it.');
      out.push({ text: ' '.repeat((pending.level + 1) * 4) + 'pass', src: pending.line, extra: true });
    }
    while (stack.length > 1) closeBlock(stack.pop());

    // Header: standard modules, then the project's own sections.
    const header = [];
    for (const mod of [...env.imports].sort()) {
      if (/^import /.test(out.find(o => o.text.trim() === 'import ' + mod)?.text || '')) continue;
      header.push({ text: `import ${mod}`, src: -1, note: `Loads Python's ${code(mod)} module, because a sentence below uses it.` });
    }
    const order = project.sections.map(s => s.file);
    const mine = order.indexOf(sec.file);
    for (const other of order.slice(0, mine)) {
      if (env.fileDefs && env.fileDefs[other]) {
        header.push({ text: `from ${other} import *`, src: -1, note: `Brings in every name from your ${sectionTitle(other)} section (${other}.py), so this section can use them.` });
      }
    }
    if (header.length) header.push({ text: '', src: -1 });
    const all = out.slice(0, docEnd).concat(header, out.slice(docEnd));
    all.forEach((o, idx) => { if (o.src >= 0) info[o.src].py.push(idx); });

    return { lines: all, info, text: all.map(o => o.text).join('\n') + '\n' };
  }

  function compileProject(project) {
    const env = { syms: new SymTable(), seen: new Set(), pass: 1, imports: new Set(), multiDirty: true };
    const fileDefs = {};
    for (const sec of project.sections) {
      const before = env.syms.size;
      translateSection(sec, env, project);
      fileDefs[sec.file] = [...env.syms.values()].some(s => s.file === sec.file && s.scope === 'module' && s.kind !== 'module');
    }
    env.pass = 2; env.seen = new Set(); env.fileDefs = fileDefs; env.multiDirty = true;
    const results = {};
    for (const sec of project.sections) results[sec.id] = translateSection(sec, env, project);
    return { results, syms: env.syms };
  }

  /* One line typed into the terminal. Uses the project's names. */
  function translateOne(text, syms) {
    const env = { syms: new SymTable(syms), seen: new Set(syms.keys()), pass: 2, imports: new Set(), multiDirty: true };
    const info = { line: 0, py: [], notes: [], warns: [], errs: [] };
    const x = makeCtx(env, 'main', info, { stack: [{ ind: 0, type: 'root' }], fn: null, level: 0 });
    let res = tLine(text, x);
    if (info.errs.length && /don't recognise/.test(info.errs[0])) {
      info.errs.length = 0; info.notes.length = 0; info.warns.length = 0;
      res = { py: tExpr(text, x), expr: true };
    }
    return { py: (res.pys || [res.py]).join('\n'), open: res.open, imports: [...env.imports], info, expr: !!res.expr };
  }

  /* ------------------------------------------------------------------ */
  /* Sentence templates: autocomplete + the Index                        */
  /* ------------------------------------------------------------------ */

  const T = (group, pattern, py, tip, sections) => ({ group, pattern, py, tip, sections: sections || ['settings', 'tools', 'main'] });
  const TEMPLATES = [
    T('Values', 'set ‹name› to ‹value›', 'name = value', 'Creates a name or changes what it holds. Names can have spaces: "high score" becomes high_score.'),
    T('Values', 'increase ‹name› by ‹amount›', 'name += amount', 'Leave off "by …" to go up by 1.', ['tools', 'main']),
    T('Values', 'decrease ‹name› by ‹amount›', 'name -= amount', 'Leave off "by …" to go down by 1.', ['tools', 'main']),
    T('Values', 'multiply ‹name› by ‹amount›', 'name *= amount', '', ['tools', 'main']),
    T('Values', 'divide ‹name› by ‹amount›', 'name /= amount', 'Always leaves a decimal number.', ['tools', 'main']),
    T('Show & ask', 'show ‹value›', 'print(value)', 'Show several things on one line by joining them with "and".', ['tools', 'main']),
    T('Show & ask', 'show "‹text› {‹name›}"', 'print(f"text {name}")', 'Anything in {curly brackets} inside text is replaced by its current value.', ['tools', 'main']),
    T('Show & ask', 'ask "‹question›" and store in ‹name›', 'name = input("question")', 'The answer is always text.', ['main']),
    T('Show & ask', 'ask for a number "‹question›" and store in ‹name›', 'name = int(input("question"))', 'Use this when you need to compare or do maths with the answer.', ['main']),
    T('Show & ask', 'ask for a decimal "‹question›" and store in ‹name›', 'name = float(input("question"))', 'For answers like 2.5.', ['main']),
    T('Decisions', 'if ‹condition›', 'if condition:', 'Indent the lines that should only happen when the condition is true.', ['tools', 'main']),
    T('Decisions', 'otherwise if ‹condition›', 'elif condition:', 'Must sit right under an if block, at the same indentation.', ['tools', 'main']),
    T('Decisions', 'otherwise', 'else:', 'Runs when nothing above it was true.', ['tools', 'main']),
    T('Loops', 'repeat ‹number› times', 'for _ in range(number):', 'Add "counting with i" to know which round you are on (starts at 0).', ['tools', 'main']),
    T('Loops', 'count ‹i› from ‹start› to ‹end›', 'for i in range(start, end + 1):', 'Includes the end number. Count backwards by going from a bigger number to a smaller one.', ['tools', 'main']),
    T('Loops', 'for each ‹item› in ‹list›', 'for item in list:', 'Works on lists, text (letter by letter) and dictionaries (key by key).', ['tools', 'main']),
    T('Loops', 'while ‹condition›', 'while condition:', 'Make sure something inside the loop can make the condition false.', ['tools', 'main']),
    T('Loops', 'repeat until ‹condition›', 'while not condition:', '', ['tools', 'main']),
    T('Loops', 'repeat forever', 'while True:', 'Pair it with "stop the loop".', ['tools', 'main']),
    T('Loops', 'stop the loop', 'break', '', ['tools', 'main']),
    T('Loops', 'skip to next', 'continue', 'Skips the rest of this round.', ['tools', 'main']),
    T('Lists', 'create list ‹name› with ‹a, b, c›', 'name = [a, b, c]', 'Leave off "with …" for an empty list.'),
    T('Lists', 'add ‹value› to ‹list›', 'list.append(value)', 'On a number, "add" increases it instead.', ['tools', 'main']),
    T('Lists', 'remove ‹value› from ‹list›', 'list.remove(value)', 'Or "remove item 0 from list" to remove by position.', ['tools', 'main']),
    T('Lists', 'sort ‹list›', 'list.sort()', 'Add "biggest first" to reverse the order.', ['tools', 'main']),
    T('Lists', 'shuffle ‹list›', 'random.shuffle(list)', '', ['tools', 'main']),
    T('Tools', 'define ‹name› using ‹inputs›', 'def name(inputs):', 'Leave off "using …" if the tool needs no inputs.', ['tools', 'main']),
    T('Tools', 'give back ‹value›', 'return value', 'Only inside a define block.', ['tools']),
    T('Tools', 'description: ‹what it does›', '"""what it does"""', 'The first line under define or define class: help text Python keeps (a docstring). Several lines in a row make one text.', ['tools', 'main']),
    T('Tools', 'run ‹tool› with ‹inputs›', 'tool(inputs)', '', ['tools', 'main']),
    T('Tools', 'run ‹tool› with ‹inputs› and store in ‹name›', 'name = tool(inputs)', 'Keeps what the tool gives back.', ['tools', 'main']),
    T('Dictionaries', 'create dictionary ‹name›', 'name = {}', 'Stores values under keys, like prices of items.'),
    T('Dictionaries', 'set item ‹key› of ‹dictionary› to ‹value›', 'dictionary[key] = value', ''),
    T('Dictionaries', 'for each ‹key›, ‹value› in pairs of ‹dictionary›', 'for key, value in dictionary.items():', 'Goes through every key together with its value.'),
    T('Dictionaries', 'delete item ‹key› of ‹dictionary›', 'del dictionary[key]', ''),
    T('Objects', 'define class ‹Name›', 'class Name:', 'A blueprint for objects. Tools defined inside it take `self` first.', ['tools', 'main']),
    T('Objects', 'define class ‹Name› based on ‹Parent›', 'class Name(Parent):', 'Builds on another class and adds to it.', ['tools', 'main']),
    T('Objects', 'set self.‹value› to ‹value›', 'self.value = value', 'Inside a class: a value each object keeps for itself.', ['tools', 'main']),
    T('Objects', 'make a new ‹Class› with ‹inputs› and store in ‹name›', 'name = Class(inputs)', 'Creates an object from a class.', ['tools', 'main']),
    T('Objects', 'run ‹object›.‹tool› with ‹inputs›', 'object.tool(inputs)', 'Runs a tool that belongs to an object or module, e.g. run conn.commit.', ['tools', 'main']),
    T('Objects', 'field ‹name›: ‹type›', 'name: type', 'Inside a data class: a value every object has.', ['tools', 'main']),
    T('Errors', 'try', 'try:', 'Indent the lines that might fail under it.', ['tools', 'main']),
    T('Errors', 'if it fails with ‹ErrorType› as ‹error›', 'except ErrorType as error:', 'What to do when the lines under "try" fail.', ['tools', 'main']),
    T('Errors', 'in any case', 'finally:', 'Always runs afterwards, error or not.', ['tools', 'main']),
    T('Errors', 'fail with ‹ErrorType›: ‹message›', 'raise ErrorType(message)', 'Stops with an error that the caller can catch.', ['tools', 'main']),
    T('Errors', 'check that ‹condition›', 'assert condition', 'Stops with an error if the check is false. Used in tests.', ['tools', 'main']),
    T('Files', 'open the file ‹path› as ‹f›', 'with open(path) as f:', 'Reads the file. The file closes itself after the indented lines.', ['tools', 'main']),
    T('Files', 'open the file ‹path› for writing as ‹f›', 'with open(path, "w") as f:', 'Replaces what was in the file. Use "for adding" to add to the end.', ['tools', 'main']),
    T('Files', 'using ‹something› as ‹name›', 'with something as name:', 'Sets something up and tidies it away afterwards.', ['tools', 'main']),
    T('Program', 'if this file is run directly', 'if __name__ == "__main__":', 'The starting point of a program made of several files.', ['main']),
    T('Program', 'when ‹app› gets ‹GET› at "‹/path›"', '@app.route("/path", methods=["GET"])', 'A Flask web route. Put "define …" on the next line.', ['tools', 'main']),
    T('Program', 'when ‹app› handles ‹GET› at "‹/path›"', '@app.get("/path")', 'A FastAPI (or Flask 2) web route. Put "define …" on the next line.', ['tools', 'main']),
    T('Program', 'decorate with ‹decorator›', '@decorator', 'Adds behaviour to the next tool or class.', ['tools', 'main']),
    T('Program', 'use the shared ‹name›', 'global name', 'Inside a tool: change a value that lives outside it.', ['tools']),
    T('Other', 'wait ‹number› seconds', 'time.sleep(number)', '', ['tools', 'main']),
    T('Other', 'do nothing', 'pass', 'A placeholder for a block you will fill in later.', ['tools', 'main']),
    T('Other', 'stop the program', 'sys.exit()', '', ['tools', 'main']),
    T('Other', 'note: ‹text›', '# text', 'A note for people. Python ignores it.'),
    T('Other', 'python: ‹code›', 'code', 'Write Python directly. Copied exactly as written.'),
  ];

  const WORDS = [
    ['a is b', 'a == b'], ['a is not b', 'a != b'], ['a is more than b', 'a > b'], ['a is less than b', 'a < b'],
    ['a is at least b', 'a >= b'], ['a is at most b', 'a <= b'], ['a plus b', 'a + b'], ['a minus b', 'a - b'],
    ['a times b', 'a * b'], ['a divided by b', 'a / b'], ['a mod b', 'a % b'], ['a to the power of b', 'a ** b'],
    ['a squared', 'a ** 2'], ['a is even', 'a % 2 == 0'], ['a is divisible by b', 'a % b == 0'],
    ['length of x', 'len(x)'], ['sum of x', 'sum(x)'], ['biggest in x', 'max(x)'], ['smallest in x', 'min(x)'],
    ['random number from 1 to 6', 'random.randint(1, 6)'], ['random item from x', 'random.choice(x)'],
    ['item 0 of x', 'x[0]'], ['first item of x', 'x[0]'], ['last item of x', 'x[-1]'],
    ['x is in y', 'x in y'], ['y contains x', 'x in y'], ['x as number', 'int(x)'], ['x as decimal', 'float(x)'],
    ['x as text', 'str(x)'], ['x rounded', 'round(x)'], ['x rounded to 2 places', 'round(x, 2)'],
    ['x in capitals', 'x.upper()'], ['square root of x', 'math.sqrt(x)'], ['yes / no', 'True / False'], ['nothing', 'None'],
    ['"Hi {name}"', 'f"Hi {name}"'],
    ['x is nothing', 'x is None'], ['a if check otherwise b', 'a if check else b'], ['pairs of d', 'd.items()'],
    ['wait for fetch(url)', 'await fetch(url)'],
  ];

  const GUIDE = {
    name: 'Python',
    purpose: 'Python is a general-purpose language that reads close to English. It is good at scripts, automating chores, working with data and text, small games and servers. It is slower than C++ and is not what web pages run in the browser (that is JavaScript).',
    rules: [
      ['Top to bottom', 'Python runs one line at a time, in order. A name must be set before a line uses it.'],
      ['Indentation is meaning', 'Lines moved right (4 spaces, the Tab key) belong to the line above that ends in a colon: an if, a loop or a tool.'],
      ['= stores, == compares', 'In sentences you write "is"; the translator picks the right one.'],
      ['Text is not a number', '"5" and 5 are different. Answers from ask are always text unless you ask for a number.'],
      ['Counting starts at 0', 'The first item of a list is item 0. range(3) counts 0, 1, 2.'],
    ],
    howtos: [
      ['Get a number from someone', 'ask for a number "How old are you? " and store in age'],
      ['Do something several times', 'repeat 3 times\n    show "Hip hip hooray!"'],
      ['Keep going until something happens', 'repeat forever\n    ask "Password? " and store in guess\n    if guess is "open sesame"\n        stop the loop'],
      ['Make a reusable tool', 'define double using n\n    give back n times 2'],
      ['Write it naturally', 'please ask for a number "Age? " and store in age then show age\nif age is at least 18 then show "Welcome"\nnote: "please", "just" and "then" are fine. Filler is left out, and "then" splits steps.'],
      ['Use a tool and keep its answer', 'run double with 21 and store in answer'],
      ['Keep a list of things', 'create list basket with "apples", "bread"\nadd "milk" to basket\nfor each item in basket\n    show "-" and item'],
    ],
    sections: {
      settings: 'Settings holds starting values the whole program shares: limits, names, lists of options. Only set values here. Nothing is shown or asked.',
      tools: 'Tools holds reusable actions. Each tool starts with "define" and does its work in the indented lines under it. Tools only run when Main program runs them.',
      main: 'Main program is what actually happens when you press Run, step by step from the top.',
    },
  };

  /* Block openers: used by the editor to auto-indent after Enter. */
  const OPENS_BLOCK = /^\s*(?:if|when (?!\S+ (?:gets|handles)\b)|otherwise|else|elif|repeat|while|until|as long as|keep (?:going|repeating)|count|for|define|create (?:a )?(?:tool|function)|make (?:a )?(?:tool|function)|forever|loop|do this|try|in any case|finally|either way|open (?:the file )?.+ as \w+$|(?:async )?using|python:.*:\s*$)\b/i;

  window.IntuiLang = window.IntuiLang || {};
  window.IntuiLang.python = {
    compileProject, translateOne, TEMPLATES, WORDS, GUIDE, OPENS_BLOCK, sectionTitle,
    FILLER: { lead: LEAD_FILLER, words: ['please', 'kindly', 'just', 'simply', 'basically', 'really', 'actually', 'quickly'], steps: ['then', 'afterwards'] },
    keywords: { python: PY_KEYWORDS, builtins: BUILTINS },
  };
})();

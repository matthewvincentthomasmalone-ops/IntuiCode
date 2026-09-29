/* IntuiCode — Python language pack.
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

  /* Names are matched ignoring case ("Score" finds score), but each keeps the spelling it was created with. */
  class SymTable extends Map {
    get(k) { return super.get(String(k).toLowerCase()); }
    has(k) { return super.has(String(k).toLowerCase()); }
    set(k, v) { return super.set(String(k).toLowerCase(), v); }
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

  // An operand: a protected string, a number, a name (with calls/indexes), or a bracketed group.
  const OPD = String.raw`(?:⟦\d+⟧|-?\d+(?:\.\d+)?|[A-Za-z_]\w*(?:\.\w+)*(?:\([^()]*\)|\[[^\[\]]*\])*|\([^()]*\)|\[[^\[\]]*\])`;
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
    { re: /\b(and|or|not)\b/gi, to: (m) => m.toLowerCase() },
  ];

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
    if (x.syms.has(py)) py = x.syms.get(py).py;
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
    let s = env.syms.get(py);
    if (!s) {
      s = { py, display: display.toLowerCase(), kind: kind || 'value', file: x.file, line: x.info.line, scope: x.fn ? 'local' : 'module', ...extra };
      env.syms.set(py, s);
      if (/\s/.test(s.display)) env.multiDirty = true;
    } else if ((s.kind === 'value' || s.kind === 'unknown') && kind && kind !== 'value') {
      s.kind = kind;
    }
    if (extra.params && !s.params) s.params = extra.params;
    const firstTime = !env.seen.has(py.toLowerCase());
    env.seen.add(py.toLowerCase());
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

    // 2. Multi-word names -> snake_case names.
    for (const m of multiNames(x.env)) q = q.replace(m.re, ' ' + m.py + ' ');

    // 3. Filler words.
    q = q.replace(/\bthe\b/gi, ' ').replace(/\s+/g, ' ').trim();

    // 4. A single = in a condition almost always means "compare".
    if (opts.cond && /(^|[^=!<>])=(?!=)/.test(q)) {
      q = q.replace(/(^|[^=!<>])=(?!=)/g, '$1 == ');
      x.note('In a condition, `=` was changed to `==`. In Python `=` stores a value and `==` compares two values.');
    }

    // 5. Phrase swaps.
    for (const r of EXPR_RULES) {
      let guard = 0, prev;
      do {
        prev = q;
        q = q.replace(r.re, r.to);
        if (q !== prev) {
          if (r.note) x.note(r.note);
          if (r.use) x.use(r.use);
        }
      } while (r.repeat && q !== prev && ++guard < 6);
      q = q.replace(/\s+/g, ' ');
    }

    // 6. Check every name.
    q = q.replace(/(?<![\w.⟦])([A-Za-z_]\w*)\b/g, (m, id, off, whole) => {
      if (PY_KEYWORDS.has(id)) return id;
      if (/^\s*=(?!=)/.test(whole.slice(off + m.length))) return id; // keyword argument, e.g. end=""
      const low = id.toLowerCase();
      if (x.syms.has(low)) {
        const s = x.syms.get(low);
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

    // 7. Tidy spacing. A lone = left now is a keyword argument, like end="".
    q = q.replace(/\s*(?<![=!<>])=(?!=)\s*/g, '=');
    q = q.replace(/\s+/g, ' ').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')').replace(/\s+,/g, ',').replace(/\[\s+/g, '[').replace(/\s+\]/g, ']').trim();

    // 8. Put the text back. Text with {name} inside becomes an f-string.
    q = q.replace(/⟦(\d+)⟧/g, (m, i) => {
      const str = strs[+i];
      if (/^[rRbBuUfF]/.test(str)) return str; // already Python (f"…", r"…"): keep exactly
      if (/\{[^{}]+\}/.test(str)) {
        const inner = str.replace(/\{([^{}]+)\}/g, (mm, e) => '{' + tExpr(e, x) + '}');
        x.note('Text with {…} inside becomes an f-string (the `f` before the quotes). Python swaps in the current value of whatever is in the curly brackets.');
        return 'f' + inner;
      }
      return str;
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
    if ((m = target.match(/^(?:the\s+)?item\s+(.+?)\s+(?:of|in)\s+(.+)$/i))) {
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
    const call = valueRaw.match(/^(?:the\s+)?(?:result|answer|output) of\s+(.+?)(?:\s+(?:with|using|on)\s+(.+))?$/i);
    if (call) value = callExpr(call[1], call[2], x);
    else value = tExpr(valueRaw, x);
    if (tgt) return { py: `${tgt.py} = ${value}` };
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
    const fnName = toName(nameRaw, x);
    const s = x.syms.get(fnName);
    const args = argsRaw && !/^nothing$/i.test(argsRaw.trim()) ? splitItems(argsRaw).map(a => tExpr(a, x)) : [];
    if (x.pass === 2) {
      if (!s) {
        const guess = closest(fnName, [...x.syms.values()].filter(v => v.kind === 'function').map(v => v.py), 3);
        x.err(`There's no tool called ${code(fnName)}.` + (guess ? ` Did you mean ${code(guess)}?` : ' Make one with "define ' + fnName.replace(/_/g, ' ') + ' using …" in Tools.'));
      } else if (s.kind !== 'function') {
        x.err(`${code(fnName)} is ${KIND_WORDS[s.kind] || 'a value'}, not a tool, so it can't be run.`);
      } else if (s.params && s.params.length !== args.length) {
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
    const d = py.match(/^\s*def\s+([A-Za-z_]\w*)\s*\(([^)]*)\)/);
    if (d) declare(x, d[1], d[1], 'function', { params: d[2].split(',').map(p => p.trim()).filter(Boolean) });
    const opens = /:\s*(#.*)?$/.test(py);
    const kw = (py.match(/^\s*(if|elif|else|for|while|def)\b/) || [])[1];
    return { py, open: opens ? (d ? 'def' : kw === 'for' || kw === 'while' ? 'loop' : 'block') : null, tag: ['if', 'elif', 'else'].includes(kw) ? kw : undefined };
  });

  rule(/^(?:note|comment)\s*:\s*(.*)$|^#\s?(.*)$/i, (m, x) => {
    return { py: '# ' + (m[1] ?? m[2] ?? ''), comment: true };
  });

  rule(/^(?:use|import)\s+(?:the\s+)?([A-Za-z_]\w*)(\s+(?:module|library|toolkit))?$/i, (m, x) => {
    const mod = m[1].toLowerCase();
    if (!MODULES.has(mod) && !m[2] && !/^import/i.test(m[0])) return null; // "use hint" means run a tool
    declare(x, mod, mod, 'module');
    x.note(`Loads Python's ${code(mod)} module so its tools can be used. Modules are toolkits that come with Python.`);
    return { py: `import ${mod}` };
  });

  // --- Tools (functions) -----------------------------------------------
  rule(/^(?:define|create (?:a )?(?:new )?(?:tool|function)|make (?:a )?(?:new )?(?:tool|function)|new tool)\s+(?:called\s+|named\s+)?(.+?)(?:\s+(?:using|with|that takes|taking|needing|given)\s+(.+))?$/i, (m, x) => {
    const name = toName(m[1], x, { define: true });
    const params = m[2] && !/^nothing$/i.test(m[2].trim()) ? splitItems(m[2]).map(p => toName(p, x)) : [];
    declare(x, name, m[1], 'function', { params });
    for (const p of params) declare(x, p, p, 'value', { scope: 'local' });
    if (x.level > 0) x.warn('This tool is defined inside another block. Usually tools are defined at the left edge, with nothing in front.');
    x.note(`${code('def')} makes a reusable tool called ${code(name)}. The indented lines under it only run when you "run ${m[1].trim()}".` + (params.length ? ` Its inputs (${params.map(code).join(', ')}) are filled in each time it runs.` : ''));
    return { py: `def ${name}(${params.join(', ')}):`, open: 'def', fn: { name, params } };
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
  rule(/^(?:wait|pause|sleep)\s+(?:for\s+)?(.+?)\s*(?:seconds?|secs?|s)$/i, (m, x) => {
    x.use('time');
    x.note('`time.sleep()` pauses the program. (In this browser preview pauses are skipped, so output appears all at once.)');
    return { py: `time.sleep(${tExpr(m[1], x)})` };
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

  function tLine(text, x) {
    let s = text.trim();
    // raw + notes first, before any punctuation clean-up
    for (const r of RULES.slice(0, 2)) {
      const m = s.match(r.re);
      if (m) return r.fn(m, x);
    }
    s = s.replace(/^(?:then|and then|next,?|now)\s+/i, '')
      .replace(/\s*:\s*$/, '')
      .replace(/(?<![\d.])\.\s*$/, '')
      .replace(/\s+(?:then|do)$/i, '');
    for (const r of RULES.slice(2)) {
      const m = s.match(r.re);
      if (m) { const res = r.fn(m, x); if (res) return res; }
    }
    // Fallback: a bare call like print("hi") or greet(name) is fine as-is.
    const e = tExpr(s, x);
    if (/^[\w.]+\(.*\)$/.test(e) && !x.info.errs.length) {
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
      if (entry.fn && entry.fn.globals.size && env.pass === 2) {
        out.splice(entry.fn.outIdx + 1, 0, { text: ' '.repeat((entry.fn.level + 1) * 4) + 'global ' + [...entry.fn.globals].join(', '), src: entry.fn.line, extra: true });
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i].replace(/\t/g, '    ');
      const cur = info[i];
      if (!rawLine.trim()) { out.push({ text: '', src: i }); continue; }
      const ind = rawLine.match(/^ */)[0].length;

      let top = stack[stack.length - 1];
      let pushed = false, popped = false, badIndent = false;
      if (pending) {
        if (ind > top.ind) { stack.push({ ind, type: pending.type, fn: pending.fn }); pushed = true; }
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
      if (!res.comment) lastTag[level] = res.tag || 'stmt';

      out.push({ text: ' '.repeat(level * 4) + res.py, src: i });
      if (res.open) {
        const fn = res.fn ? { ...res.fn, outIdx: out.length - 1, level, line: i, locals: new Set(res.fn.params), globals: new Set() } : null;
        if (fn) fnRecords.push(fn);
        pending = { line: i, type: res.open, level, outIdx: out.length - 1, fn };
      }
    }
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
    const all = header.concat(out);
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
    return { py: res.py, open: res.open, imports: [...env.imports], info, expr: !!res.expr };
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
    T('Lists', 'create dictionary ‹name›', 'name = {}', 'Stores values under keys, like prices of items.'),
    T('Lists', 'set item ‹key› of ‹name› to ‹value›', 'name[key] = value', 'Works for lists (key is a position) and dictionaries.'),
    T('Tools', 'define ‹name› using ‹inputs›', 'def name(inputs):', 'Leave off "using …" if the tool needs no inputs.', ['tools', 'main']),
    T('Tools', 'give back ‹value›', 'return value', 'Only inside a define block.', ['tools']),
    T('Tools', 'run ‹tool› with ‹inputs›', 'tool(inputs)', '', ['tools', 'main']),
    T('Tools', 'run ‹tool› with ‹inputs› and store in ‹name›', 'name = tool(inputs)', 'Keeps what the tool gives back.', ['tools', 'main']),
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
  const OPENS_BLOCK = /^\s*(?:if|when|otherwise|else|elif|repeat|while|until|as long as|keep (?:going|repeating)|count|for|define|create (?:a )?(?:tool|function)|make (?:a )?(?:tool|function)|forever|loop|do this|python:.*:\s*$)\b/i;

  window.IntuiLang = window.IntuiLang || {};
  window.IntuiLang.python = {
    compileProject, translateOne, TEMPLATES, WORDS, GUIDE, OPENS_BLOCK, sectionTitle,
    keywords: { python: PY_KEYWORDS, builtins: BUILTINS },
  };
})();

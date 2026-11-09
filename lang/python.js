/* IntuaCode — Python language pack.
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
  const MODULES = new Set(['random', 'math', 'time', 'sys', 'string', 'datetime', 'os', 'json']);
  const WORD_NUMBERS = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100 };
  // "twenty one", "forty-two": one number, not two
  const TENS_UNITS = /\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)[\s-]+(one|two|three|four|five|six|seven|eight|nine)\b/gi;
  // Words sentences read as values or operators: a name like these would be read as that instead.
  const VALUE_WORDS = { yes: 'True', no: 'False', true: 'True', false: 'False', nothing: 'None', none: 'None', otherwise: 'else', plus: '+', minus: '-', times: '*', mod: '%', modulo: '%', equals: '==', squared: '** 2', cubed: '** 3', rounded: 'round()' };
  // How phrases like "length of x" start: a multi-word name starting like this could be read either way.
  const PHRASE_LEAD = /^(?:(?:length|size|sum|total|count|number) of |(?:first|last) (?:item|one|thing) (?:of|in) |square root of |absolute (?:value )?of |(?:biggest|largest|highest|maximum|smallest|lowest|minimum) (?:of|in) |random (?:item|choice|one) (?:from|of|in) |pairs (?:of|in) )/i;
  const FILE_ORDER = { settings: 0, tools: 1, main: 2 };
  const ALWAYS_KNOWN = new Set(['self', 'cls', '__name__', '__file__', 'Exception', 'ValueError', 'TypeError', 'KeyError', 'IndexError', 'open', 'dict', 'object', 'super', 'getattr', 'setattr', 'hasattr', 'isinstance', 'iter', 'next', 'repr', 'format', 'vars', 'id', 'hash', 'callable', 'exit',
    // Python's own, always there: more kinds of value and the errors programs most often catch
    'bytes', 'bytearray', 'frozenset', 'complex', 'slice', 'property', 'staticmethod', 'classmethod', 'NotImplemented', 'Ellipsis',
    'ArithmeticError', 'AssertionError', 'AttributeError', 'ConnectionError', 'EOFError', 'FileExistsError', 'FileNotFoundError',
    'ImportError', 'KeyboardInterrupt', 'LookupError', 'ModuleNotFoundError', 'NameError', 'NotImplementedError', 'OSError',
    'OverflowError', 'PermissionError', 'RuntimeError', 'StopIteration', 'TimeoutError', 'UnicodeDecodeError', 'ZeroDivisionError',
    'BrokenPipeError', 'ConnectionRefusedError', 'ConnectionResetError', 'IsADirectoryError', 'RecursionError']);

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
  const PAREN = nest('\\(', '\\)'), SQUARE = nest('\\[', '\\]'), CURLY = nest('\\{', '\\}');
  // An operand: a protected string, a number, a name or a bracketed group ({…} too: a dictionary or set), then any
  // .names, calls and indexes.
  const OPD = String.raw`(?:⟦\d+⟧|-?\d+(?:\.\d+)?|[A-Za-z_]\w*|${PAREN}|${SQUARE}|${CURLY})(?:\.[A-Za-z_]\w*|${PAREN}|${SQUARE})*`;
  // "\b" can't sit before quoted text (⟦0⟧), so operands use a look-behind instead.
  const R = (src) => new RegExp(src.replace(/\\b\(OPD\)/g, '(?<![\\w.])(OPD)').replace(/OPD/g, OPD), 'gi');

  const EXPR_RULES = [
    // Looking things up
    { re: R(String.raw`\bfirst (?:item|one|thing) (?:of|in|from) (OPD)`), to: '$1[0]', note: 'Python counts positions from 0, so the first item is `[0]`.' },
    { re: R(String.raw`\blast (?:item|one|thing) (?:of|in|from) (OPD)`), to: '$1[-1]', note: '`[-1]` counts from the end: it is always the last item.' },
    // an item that may not be there: .get gives the value to use instead (or None) rather than stopping with an error
    { re: R(String.raw`\bitem (?!is\b|not\b|in\b)(OPD) (?:of|in|from) (OPD) or (OPD) if there (?:isn't|is not) one\b`), to: '$2.get($1, $3)', note: '`.get(key, other)` gives the item under that key, or `other` when there is none (square brackets would stop with an error).' },
    { re: R(String.raw`\bitem (?!is\b|not\b|in\b)(OPD) (?:of|in|from) (OPD) if there is one\b`), to: '$2.get($1)', note: '`.get(key)` gives the item under that key, or `None` when there is none.' },
    { re: R(String.raw`\blast item taken out of (OPD)`), to: '$1.pop()', note: '`.pop()` takes the last item out of the list and gives it back.' },
    { re: R(String.raw`\bitem (?!is\b|not\b|in\b)(OPD) taken out of (OPD)`), to: '$2.pop($1)', note: '`.pop(n)` takes that item out and gives it back.' },
    { re: R(String.raw`\benvironment variable (OPD) or (OPD) if there (?:isn't|is not) one\b`), to: 'os.getenv($1, $2)', use: 'os', note: '`os.getenv(name, other)` reads a setting from the computer\'s environment, or gives `other` when it isn\'t set.' },
    { re: R(String.raw`\benvironment variable (OPD)`), to: 'os.getenv($1)', use: 'os', note: '`os.getenv(name)` reads a setting from the computer\'s environment (`None` when it isn\'t set).' },
    { re: R(String.raw`\bthere is no file or folder at (OPD)`), to: 'not os.path.exists($1)', use: 'os', note: '`os.path.exists` checks whether a file or folder is there.' },
    { re: R(String.raw`\bthere is a file or folder at (OPD)`), to: 'os.path.exists($1)', use: 'os', note: '`os.path.exists` checks whether a file or folder is there.' },
    { re: R(String.raw`\bitem (?!is\b|not\b|in\b)(OPD) (?:of|in|from) (OPD)`), to: '$2[$1]', note: 'Square brackets pick one item. For lists, Python counts from 0: item 0 is the first one.' },
    // Functions written as words, e.g. "length of x"
    { re: R(String.raw`\b(?:length|size) of (OPD)`), to: 'len($1)', repeat: true },
    { re: R(String.raw`\b(?:how many (?:items )?(?:are )?in|number of items in|count of) (OPD)`), to: 'len($1)', repeat: true },
    { re: R(String.raw`\b(?:sum|total) of (OPD)`), to: 'sum($1)', repeat: true },
    { re: R(String.raw`\b(?:biggest|largest|highest|maximum|max) (?:of|in) (OPD)`), to: 'max($1)', repeat: true },
    { re: R(String.raw`\b(?:smallest|lowest|minimum|min) (?:of|in) (OPD)`), to: 'min($1)', repeat: true },
    { re: R(String.raw`\bsquare root of (OPD)`), to: 'math.sqrt($1)', use: 'math', note: '`math.sqrt` lives in the `math` module, so it is imported for you.' },
    { re: R(String.raw`\babsolute (?:value )?of (OPD)`), to: 'abs($1)' },
    // (postfix: these follow their value, so after a sum they could mean the last value or the whole sum)
    { re: R(String.raw`\b(OPD) rounded to (OPD) (?:decimal )?places?`), to: 'round($1, $2)', postfix: true },
    { re: R(String.raw`\b(OPD) rounded\b`), to: 'round($1)', postfix: true },
    { re: R(String.raw`\b(OPD) sorted by (OPD) biggest first\b`), to: 'sorted($1, key=$2, reverse=True)', note: '`sorted(…, key=…)` orders the items by what the key tool gives for each; `reverse=True` puts the biggest first.', postfix: true },
    { re: R(String.raw`\b(OPD) sorted by (OPD)`), to: 'sorted($1, key=$2)', note: '`sorted(…, key=…)` orders the items by what the key tool gives for each one.', postfix: true },
    { re: R(String.raw`\b(OPD) sorted biggest first\b`), to: 'sorted($1, reverse=True)', note: '`reverse=True` puts the biggest first.', postfix: true },
    { re: R(String.raw`\bsorted (OPD)`), to: 'sorted($1)', note: '`sorted()` makes a new sorted copy and leaves the original list alone.' },
    { re: R(String.raw`\b(OPD) sorted\b(?!\()`), to: 'sorted($1)', note: '`sorted()` makes a new sorted copy and leaves the original list alone.', postfix: true },
    // JSON: text that holds data (lists, dictionaries, numbers…), as web APIs and settings files use
    { re: R(String.raw`\b(OPD) as JSON text\b`), to: 'json.dumps($1)', use: 'json', note: '`json.dumps()` writes the value as JSON text.', postfix: true },
    { re: R(String.raw`\b(OPD) read as JSON\b`), to: 'json.loads($1)', use: 'json', note: '`json.loads()` reads JSON text into lists, dictionaries, numbers and text.', postfix: true },
    { re: R(String.raw`\bJSON read from (OPD)`), to: 'json.load($1)', use: 'json', note: '`json.load()` reads the JSON in an open file.' },
    { re: R(String.raw`\b(OPD) as an? JSON (?:reply|response)\b`), to: 'jsonify($1)', note: "`jsonify()` (Flask's) turns the value into a JSON reply for the web browser or app that asked.", postfix: true },
    { re: R(String.raw`\bJSON sent with (OPD)`), to: '$1.get_json()', note: '`.get_json()` reads the JSON data sent with a web request.' },
    { re: R(String.raw`\b(OPD) as (?:a )?(?:whole )?number\b`), to: 'int($1)', note: '`int()` turns text like "42" into the whole number 42. It stops with an error if the text is not a number.', postfix: true },
    { re: R(String.raw`\b(OPD) as (?:a )?decimal(?: number)?\b`), to: 'float($1)', note: '`float()` turns text into a decimal number, like 3.5.', postfix: true },
    { re: R(String.raw`\b(OPD) as text\b`), to: 'str($1)', note: '`str()` turns a value into text, so it can be joined to other text.', postfix: true },
    { re: R(String.raw`\b(OPD) in (?:capitals|capital letters|uppercase|upper case)\b`), to: '$1.upper()', postfix: true },
    { re: R(String.raw`\b(OPD) in (?:lowercase|lower case|small letters)\b`), to: '$1.lower()', postfix: true },
    // Text's own tools, in words
    { re: R(String.raw`\b(OPD) trimmed\b`), to: '$1.strip()', note: '`.strip()` takes the spaces (and tabs and new lines) off both ends of the text.', postfix: true },
    { re: R(String.raw`\b(OPD) split into words\b`), to: '$1.split()', note: '`.split()` cuts the text at every run of spaces and gives back a list of the words.', postfix: true },
    { re: R(String.raw`\b(OPD) split at (OPD)`), to: '$1.split($2)', note: '`.split(x)` cuts the text at every x and gives back a list of the pieces.', postfix: true },
    { re: R(String.raw`\b(OPD) joined by (OPD)`), to: '$2.join($1)', note: '`text.join(items)` puts the items together into one text, with that text between each.', postfix: true },
    { re: R(String.raw`\b(OPD) with (OPD) replaced by (OPD)`), to: '$1.replace($2, $3)', note: '`.replace(a, b)` gives a copy of the text with every a swapped for b.', postfix: true },
    { re: R(String.raw`\b(OPD) (?:does not|doesn't) start with (OPD)`), to: 'not $1.startswith($2)', postfix: true },
    { re: R(String.raw`\b(OPD) starts with (OPD)`), to: '$1.startswith($2)', postfix: true },
    { re: R(String.raw`\b(OPD) (?:does not|doesn't) end with (OPD)`), to: 'not $1.endswith($2)', postfix: true },
    { re: R(String.raw`\b(OPD) ends with (OPD)`), to: '$1.endswith($2)', postfix: true },
    { re: R(String.raw`\b(OPD) is not all letters or digits\b`), to: 'not $1.isalnum()', postfix: true },
    { re: R(String.raw`\b(OPD) is all letters or digits\b`), to: '$1.isalnum()', note: '`.isalnum()` is true when the text has only letters and digits (and isn\'t empty).', postfix: true },
    { re: R(String.raw`\b(OPD) is not all letters\b`), to: 'not $1.isalpha()', postfix: true },
    { re: R(String.raw`\b(OPD) is all letters\b`), to: '$1.isalpha()', note: '`.isalpha()` is true when the text has only letters (and isn\'t empty).', postfix: true },
    { re: R(String.raw`\b(OPD) is not all digits\b`), to: 'not $1.isdigit()', postfix: true },
    { re: R(String.raw`\b(OPD) is all digits\b`), to: '$1.isdigit()', note: '`.isdigit()` is true when the text has only digits (and isn\'t empty).', postfix: true },
    { re: R(String.raw`\bpairs (?:of|in) (OPD)`), to: '$1.items()', note: '`.items()` gives the key and value of each entry in a dictionary, as pairs.' },
    // Randomness
    { re: R(String.raw`\brandom (?:whole )?number (?:from|between) (OPD) (?:to|and) (OPD)`), to: 'random.randint($1, $2)', use: 'random', range: true, note: '`random.randint(a, b)` can give back a or b, and anything in between. The `random` module is imported for you.' },
    { re: R(String.raw`\brandom (?:decimal|fraction)\b`), to: 'random.random()', use: 'random', note: '`random.random()` gives a decimal from 0 up to (not including) 1.' },
    { re: R(String.raw`\brandom (?:item|choice|one|pick|thing) (?:from|of|in) (OPD)`), to: 'random.choice($1)', use: 'random', note: '`random.choice()` picks one item from a list. The `random` module is imported for you.' },
    // Powers
    { re: R(String.raw`\b(OPD) squared\b`), to: '$1 ** 2', note: '`**` means "to the power of".' },   // (a power binds tightest, as in maths: x minus x squared is x - x²)
    { re: R(String.raw`\b(OPD) cubed\b`), to: '$1 ** 3', note: '`**` means "to the power of".' },
    // Comparisons that need both sides. "n plus 1 is even" is about n plus 1, so a sum on the left goes in brackets.
    { re: R(String.raw`(?<![\w.])(OPD(?: (?:plus|minus|times|multiplied by|divided by|mod|modulo|[-+*/%]) OPD)*) is (?:exactly )?divisible by (OPD)`), to: (m, a, b) => `${sumBrackets(a)} % ${b} == 0`, note: '`%` gives the remainder after dividing. A remainder of 0 means it divides exactly.' },
    { re: R(String.raw`(?<![\w.])(OPD(?: (?:plus|minus|times|multiplied by|divided by|mod|modulo|[-+*/%]) OPD)*) is not even\b`), to: (m, a) => `${sumBrackets(a)} % 2 != 0`, note: '`% 2` is the remainder after dividing by 2: anything but 0 means it isn\'t even.' },
    { re: R(String.raw`(?<![\w.])(OPD(?: (?:plus|minus|times|multiplied by|divided by|mod|modulo|[-+*/%]) OPD)*) is not odd\b`), to: (m, a) => `${sumBrackets(a)} % 2 == 0`, note: '`% 2` is the remainder after dividing by 2: 0 means it isn\'t odd.' },
    { re: R(String.raw`(?<![\w.])(OPD(?: (?:plus|minus|times|multiplied by|divided by|mod|modulo|[-+*/%]) OPD)*) is even\b`), to: (m, a) => `${sumBrackets(a)} % 2 == 0`, note: '`% 2` is the remainder after dividing by 2: 0 for even numbers.' },
    { re: R(String.raw`(?<![\w.])(OPD(?: (?:plus|minus|times|multiplied by|divided by|mod|modulo|[-+*/%]) OPD)*) is odd\b`), to: (m, a) => `${sumBrackets(a)} % 2 == 1`, note: '`% 2` is the remainder after dividing by 2: 1 for odd numbers.' },
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
    { re: /\bto (?:the )?power of\b/gi, to: ' ** ' },   // ("the" is already left out by now)
    // Plain values
    { re: /\ban empty list\b|\bempty list\b/gi, to: '[]' },
    { re: /\ban empty dictionary\b|\bempty dictionary\b/gi, to: '{}' },
    { re: /\ban empty set\b|\bempty set\b/gi, to: 'set()', note: '`set()` is an empty set: a collection that keeps each value once, in no order. (`{}` would be an empty dictionary.)' },
    { re: /\bempty text\b/gi, to: '""' },
    { re: /\b(?:yes|true)\b/gi, to: 'True' },
    { re: /\b(?:no|false)\b/gi, to: 'False' },
    { re: /\b(?:nothing|none)\b/gi, to: 'None' },
    { re: /\botherwise\b/gi, to: ' else ', note: '`a if condition else b` picks one of two values in a single line.' },
    { re: /\b(and|or|not)\b/gi, to: (m) => m.toLowerCase() },
  ];
  // Rules ending in an operand, like "length of x": what follows it must not belong to it (see tExpr).
  for (const r of EXPR_RULES) r.endsInOperand = r.re.source.endsWith(`(${OPD})`);
  // where a phrase starts: a value starting like this is a phrase still to be read
  const NESTED = /^(?:sorted \S|(?:length|size|sum|total) of |count of |(?:first|last) (?:item|one|thing) (?:of|in|from) |item \S+ (?:of|in|from) |square root of |absolute (?:value )?of |(?:biggest|largest|highest|maximum|max|smallest|lowest|minimum|min) (?:of|in) |random (?:whole )?number |random (?:item|choice|one|pick|thing) (?:from|of|in) |random (?:decimal|fraction)\b|pairs (?:of|in) |how many |number of items in )/i;
  /* A phrase ending in a value ("length of x"), applied from the right, so in "item 1 of item 0 of grid" the
     inner one goes first; one whose value starts another phrase waits for it. */
  function innermostFirst(q, r) {
    const sticky = new RegExp(r.re.source, r.re.flags.replace('g', '') + 'y');
    // a rule that starts with its own value ("n minus 1 is divisible by 3") reads from the left, so that value is all of it
    const fromLeft = r.re.source.startsWith('(?<![\\w.])(');
    let waiting = false;
    for (let guard = 0; guard < 30; guard++) {
      let changed = false;
      for (let j = 0; j < q.length; j++) {
        const i = fromLeft ? j : q.length - 1 - j;
        sticky.lastIndex = i;
        const m = sticky.exec(q);
        if (!m) continue;
        const last = m[m.length - 1];
        if (last && NESTED.test(q.slice(i + m[0].length - last.length))) { waiting = true; continue; }
        const rep = typeof r.to === 'function' ? r.to(...m, i, q) : r.to.replace(/\$(\d)/g, (_, n) => m[+n] ?? '');
        q = q.slice(0, i) + rep + q.slice(i + m[0].length);
        changed = true;
        break;
      }
      if (!changed) break;
    }
    return { q, waiting };
  }
  // a calculation, in brackets when it has more than one value: (n plus 1)
  function sumBrackets(a) { return / /.test(a.trim()) ? `(${a.trim()})` : a; }
  // the end of a sum, just before a phrase: "… divided by" or "… +"
  const BEFORE_OP = /(?:\b(?:plus|minus|times|multiplied by|divided by|mod|modulo|to the power of|added to|take away|joined (?:with|to)|followed by)|[-+*/%])\s*$/i;
  const AFTER_OP = /^\s+(?:plus|minus|times|multiplied by|divided by|mod|modulo|to the power of|[-+*/%])(?=\s)/i;
  // a comparison, then "or"/"and" with a bare value after it: `answer == "yes" or "y"`
  const EITHER = new RegExp(String.raw`(?<![\w.⟧\])])(OPD) (==|!=|<=|>=|<|>|not in|in) (OPD) (or|and) (⟦\d+⟧|-?\d+(?:\.\d+)?|True|False|None)(?= *(?:$|[)\],]|or\b|and\b|else\b|if\b))`.replace(/OPD/g, OPD));

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
    // "a b" when there's a name a: the name a and then b, or "a" as in "a counter"? Never guess which.
    const lead = t.match(/^(a|an|the|my)\s+(\S.*)$/i);
    if (x.pass === 2 && lead && x.syms.get(lead[1]) && /^[A-Za-z_]\w*$/.test(lead[2].replace(/\s+/g, '_')))
      x.err(`"${t}" could be your name ${code(lead[1])} followed by "${lead[2]}", or "${lead[1]}" as a word that's left out (as in "set a counter to 1"). Write the name you mean with _ (${lead[1]}_${lead[2].replace(/\s+/g, '_')}) or give it a name that doesn't start with "${lead[1]}".`);
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
    } else if (opts.define && VALUE_WORDS[py.toLowerCase()]) {
      x.err(`"${t}" is a word sentences read as ${code(VALUE_WORDS[py.toLowerCase()])}, so as a name it would be read that way instead. Try something like "my ${t}" or "${t} count".`);
    }
    if (opts.define && BUILTINS.has(py)) {
      x.warn(`${code(py)} is already a built-in Python tool. Naming something ${code(py)} hides the built-in one.`);
    }
    if (opts.define && !opts.param && MODULES.has(py)) {   // (a tool's own input called time only stands in its way inside the tool)
      x.warn(`${code(py)} is also Python's ${code(py)} module, which some sentences use (${py === 'time' ? '"wait …"' : py === 'random' ? '"random number from …"' : 'it'}). A value called ${code(py)} would stand in its way. Choose another name, like "${py} left".`);
    }
    if (opts.define && /\s/.test(t) && PHRASE_LEAD.test(t)) {
      x.warn(`"${t}" starts like the phrase "${t.match(PHRASE_LEAD)[0].trim()}", so wherever it's used it could be read either way. A name like "${t.replace(PHRASE_LEAD, '')} ${t.match(PHRASE_LEAD)[0].trim().split(' ')[0]}" avoids that.`);
    }
    if (/\s/.test(t)) x.note(`Python names can't contain spaces, so "${t.toLowerCase()}" is written ${code(py)}.`);
    return py;
  }

  /* Where a name is set: a tool ("fn:file/name"), or the top of a file ("mod:file"). What a name holds is
     kept per place, so a list in Main and some text in a tool, both called result, stay what they are. */
  const scopeKey = (x) => (x.fn ? `fn:${x.file}/${x.fn.name}` : `mod:${x.file}`);
  function declare(x, py, display, kind, extra = {}) {
    const env = x.env;
    const where = extra.where || scopeKey(x);
    delete extra.where;
    let s = env.syms.map.get(py);   // declaring needs the exact spelling
    if (!s) {
      s = { py, display: display.toLowerCase(), kind: kind || 'value', file: x.file, line: x.info.line, scope: where.startsWith('fn:') ? 'local' : 'module', kinds: {}, ...extra };
      env.syms.set(py, s);
      if (/\s/.test(s.display)) env.multiDirty = true;
    } else if ((s.kind === 'value' || s.kind === 'unknown') && kind && kind !== 'value') {
      s.kind = kind;
    }
    s.kinds = s.kinds || {};
    if (where.startsWith('mod:')) {   // the first line it's set on at the top of each file (see assigned)
      s.top = s.top || {};
      if (s.top[x.file] == null || x.info.line < s.top[x.file]) s.top[x.file] = x.info.line;
    }
    const had = s.kinds[where];
    if (!had || ((had === 'value' || had === 'unknown') && kind && kind !== 'value')) s.kinds[where] = kind || 'value';
    // a number here and a list there, in the same place: it can't be told which it holds at any one line
    else if (kind && kind !== 'value' && had !== kind) s.kinds[where] = 'mixed';
    if (extra.params && !s.params) s.params = extra.params;
    const firstTime = !env.seen.has(py);
    env.seen.add(py);
    return firstTime;
  }
  /* What a name holds here: as set in this tool, else at the top of this file, else at the top of another
     file. 'value' when that can't be known. */
  function kindHere(x, py) {
    const s = x.syms.get(py);
    if (!s) return /^self\.[A-Za-z_]\w*$/.test(py) ? x.env.attrs?.get(`${x.file}:${py}`) : undefined;
    const k = s.kinds || {};
    return k[scopeKey(x)] || k[`mod:${x.file}`] || Object.entries(k).find(([w]) => w.startsWith('mod:'))?.[1] || s.kind;
  }
  /* Set somewhere at the top of a file (not only inside tools)? */
  const atTop = (s, file) => !!s && !!s.kinds && Object.keys(s.kinds).some(w => w.startsWith('mod:') && (!file || w === `mod:${file}`));

  function multiNames(env) {
    if (env.multiDirty || !env.multi) {
      env.multi = [...env.syms.values()]
        .filter(s => /\s/.test(s.display))
        .sort((a, b) => b.display.length - a.display.length)
        .map(s => ({ py: s.py, display: s.display, re: new RegExp('\\b' + s.display.split(/\s+/).map(esc).join('[\\s_-]+') + '\\b', 'gi') }));
      env.multiDirty = false;
    }
    return env.multi;
  }

  /* Record assignments inside a tool so `global` can be added when needed. A name set at the top of the
     file *above* the tool is the program's shared value, so setting it in the tool changes that one (the
     translator adds `global`). One set only *below* the tool (like the starting block at the end of a
     file) isn't: setting it makes the tool's own copy, which is Python's rule. Changing a name in place
     ("increase score by 1", changes = true) can only mean the one outside, wherever it is. Lines are
     compared, not the order names were first seen, so the same file always gives the same code. */
  function assigned(x, py, changes = false) {
    const fn = x.fn;
    if (!fn || x.pass !== 2) return;
    if (fn.locals.has(py) || fn.globals.has(py)) return;
    const s = x.syms.get(py);
    const above = !!s && !!s.top && s.top[x.file] != null && s.top[x.file] < fn.line;
    const below = !above && atTop(s, x.file);
    // set at the top of a section this one imports (one before it); later sections can't be seen from here
    const order = x.env.order || [], mine = order.indexOf(x.file);
    const otherFile = !above && !below && !!s && !!s.top && Object.keys(s.top).some(f => f !== x.file && order.indexOf(f) >= 0 && order.indexOf(f) < mine);
    const shared = fn.explicit && fn.explicit.has(py);
    if (above || otherFile || shared || (below && changes)) {
      fn.globals.add(py);
      if (otherFile) x.warn(`${code(py)} is set in another section. Changing it inside a tool only changes this section's copy. To share a result, use "give back" and store it where you run the tool.`);
      else if (!shared) x.note(`${code(py)} lives outside this tool, so the translator adds ${code('global ' + py)} at the top of the tool. Without it, Python would make a separate copy inside the tool.`);
    } else {
      fn.locals.add(py);
      if (below) x.note(`${code(py)} is also set further down, outside this tool. Setting it here makes the tool's own copy (that's Python's rule), so that one doesn't change. To change it, start the tool with "use the shared ${py}", or set it above the tool.`);
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

  /* Comprehensions in words. A value (or the inside of a pair of brackets) that reads
       [a list of | a set of | a dictionary of] X for each V in Y [if C]   -> [X for V in Y if C], {…}, or (… for …)
       X for every V in Y [if C] / X for any V in Y [if C]                 -> all(X for V in Y …) / any(…)
     is written as Python's own. The inside of each pair of brackets is read first, so one can sit inside another. */
  function comprehensions(q, x) {
    const OPEN = '([{', CLOSE = ')]}';
    const closeOf = (s, i) => { for (let d = 0, j = i; j < s.length; j++) { if (OPEN.includes(s[j])) d++; else if (CLOSE.includes(s[j]) && --d === 0) return j; } return -1; };
    // where a word sits outside every bracket
    const top = (s, re) => {
      const g = new RegExp(re.source, re.flags.replace('g', '') + 'g');
      for (const m of s.matchAll(g)) {
        let d = 0;
        for (let j = 0; j < m.index; j++) { if (OPEN.includes(s[j])) d++; else if (CLOSE.includes(s[j])) d--; }
        if (!d) return m;
      }
      return null;
    };
    const one = (seg, open) => {
      const f = top(seg, / for (each|every|any) /i);
      if (!f) return seg;
      let lead = seg.slice(0, f.index).trim(), kind = f[1].toLowerCase(), after = seg.slice(f.index + f[0].length);
      const v = after.match(/^([A-Za-z_]\w*(?:\s*,\s*[A-Za-z_]\w*)*)\s+in\s+/i);
      if (!v || !lead) return seg;
      after = after.slice(v[0].length);
      const cond = top(after, / if /i);
      const from = (cond ? after.slice(0, cond.index) : after).trim(), test = cond ? after.slice(cond.index + cond[0].length).trim() : '';
      const made = kind === 'each' && lead.match(/^(?:an?\s+)?(list|set|dictionary)\s+of\s+/i);
      if (made) lead = lead.slice(made[0].length);
      const body = `${lead} for ${v[1].replace(/\s*,\s*/g, ', ')} in ${from}${test ? ' if ' + test : ''}`;
      x.note('A list (or set, dictionary) made in one go, from each item of another: Python calls this a comprehension.');
      if (kind !== 'each') return `${kind === 'every' ? 'all' : 'any'}(${body})`;
      if (made) return made[1].toLowerCase() === 'list' ? `[${body}]` : `{${body}}`;
      return open ? body : `(${body})`;   // inside brackets already, or a generator in brackets of its own
    };
    const walk = (seg, open) => {
      let out = '';
      for (let i = 0; i < seg.length;) {
        if (OPEN.includes(seg[i])) {
          const j = closeOf(seg, i);
          if (j < 0) { out += seg.slice(i); break; }
          out += seg[i] + walk(seg.slice(i + 1, j), seg[i]) + seg[j];
          i = j + 1;
        } else out += seg[i++];
      }
      return one(out, open);
    };
    return walk(q, '');
  }

  function tExpr(src, x, opts = {}) {
    let s = String(src == null ? '' : src).trim();
    if (!s) { x.err('Something is missing here: a value or a condition.'); return 'None'; }
    const slot = s.match(/‹[^›]*›/);
    if (slot) { x.err(`Fill in the ${slot[0]} slot.`); s = s.replace(/‹[^›]*›/g, '_'); }

    // 1. Protect text in quotes so nothing inside is swapped. A .name or [ right after the text stays attached,
    //    so it is part of the same operand: length of "a b".split() is len("a b".split()), not len("a b").split().
    const strs = [];
    let q = s.replace(/(?<![\w])[rRbBuUfF]{0,2}(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, (m, off, all) => { strs.push(m); return ` ⟦${strs.length - 1}⟧` + (/^(?:\.[A-Za-z_]|\[)/.test(all.slice(off + m.length)) ? '' : ' '); });
    if (/["]/.test(q)) { x.err('A piece of text is missing its closing quote mark (").'); q = q.replace(/"/g, ''); }
    if (/(^|\s)'|'(\s|$)/.test(q)) { x.err("A piece of text is missing its closing quote mark (')."); }

    // 2. Multi-word names -> snake_case names. Brackets or a .name right after one stay attached: all_notes().
    for (const m of multiNames(x.env)) q = q.replace(m.re, (w, off, all) => {
      // "length of rope" is a name, but also "length of" + rope when rope is a name too: two readings
      const lead = m.display.match(PHRASE_LEAD), rest = lead && m.display.slice(lead[0].length).trim().replace(/\s+/g, '_');
      if (rest && x.syms.has(rest)) x.err(`"${w}" could be the name ${code(m.py)} or "${lead[0].trim()}" ${code(rest)}. Rename one of them (a name like "${m.display.slice(lead[0].length).trim()} ${lead[0].trim().split(' ')[0]}" can't be misread).`);
      return ' ' + m.py + (/^(?:[([]|\.[A-Za-z_])/.test(all.slice(off + w.length)) ? '' : ' ');
    });
    // 2b. A tool's name and its brackets belong together even with a space between: "all notes ()" runs all_notes.
    q = q.replace(/(?<![\w.])([A-Za-z_]\w*)\s+\(/g, (w, id) => {
      const kind = x.syms.get(id)?.kind;
      return (kind ? kind === 'function' || kind === 'class' : BUILTINS.has(id)) ? id + '(' : w;
    });

    // 3. Filler words ("my score" is score, as when it was set).
    q = q.replace(/\bthe\b/gi, ' ').replace(/\bmy\s+(?=[A-Za-z_])/gi, ' ').replace(/\s+/g, ' ').trim();
    // 3b. "a list of x times 2 for each x in xs": a list (set, dictionary) made in one go: Python's comprehensions
    if (/\bfor (?:each|every|any) /i.test(q)) q = comprehensions(q, x);

    // 4. A single = in a condition almost always means "compare" (but not inside brackets: max(xs, key=abs)).
    if (opts.cond && /(^|[^=!<>])=(?!=)/.test(q)) {
      let depth = 0, out = '', changed = false;
      for (let i = 0; i < q.length; i++) {
        const c = q[i];
        if ('([{'.includes(c)) depth++; else if (')]}'.includes(c)) depth--;
        if (c === '=' && depth === 0 && q[i + 1] !== '=' && !/[=!<>]/.test(q[i - 1] || '')) { out += ' == '; changed = true; } else out += c;
      }
      q = out;
      if (changed) x.note('In a condition, `=` was changed to `==`. In Python `=` stores a value and `==` compares two values.');
    }
    // "twenty one" is one number, and so is "three hundred"
    q = q.replace(TENS_UNITS, (m, t, u) => String(WORD_NUMBERS[t.toLowerCase()] + WORD_NUMBERS[u.toLowerCase()]));
    q = q.replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten|\d+) (hundred|thousand)\b/gi, (m, n, h) => String((/^\d+$/.test(n) ? +n : WORD_NUMBERS[n.toLowerCase()]) * (h.toLowerCase() === 'hundred' ? 100 : 1000)));

    // 4b. "wait for x" inside a value means await (used with async tools).
    if (/\bwait for\b/i.test(q)) { q = q.replace(/\bwait for\b/gi, ' await '); x.note('`await` waits for an async task to finish before carrying on.'); }

    // Names bound inside the expression itself (comprehensions, lambdas) are not "unknown".
    const bound = new Set();
    for (const m of q.matchAll(/\bfor\s+([A-Za-z_]\w*(?:\s*,\s*[A-Za-z_]\w*)*)\s+in\b/g)) m[1].split(/\s*,\s*/).forEach(n => bound.add(n));
    for (const m of q.matchAll(/\blambda\s+([^:]*):/g)) m[1].split(/\s*,\s*/).forEach(n => bound.add(n.replace(/=.*/, '').trim()));

    // 5. Phrase swaps. Two readings are an error, never a guess.
    const said = (t) => t.trim().replace(/⟦(\d+)⟧/g, (_, i) => strs[+i]).replace(/\s+/g, ' ');
    // A phrase whose value starts another phrase ("first item of sorted xs") waits for that one, so phrases
    // inside phrases go first; the rules run again (a few times at most) until nothing is waiting.
    for (let pass = 0, waiting = true; waiting && pass < 4; pass++) {
    waiting = false;
    for (const r of EXPR_RULES) {
      let guard = 0, prev;
      do {
        prev = q;
        if (r.endsInOperand) for (const m of q.matchAll(r.re)) looseBrackets(m, q, strs, x);
        if (r.postfix) for (const m of q.matchAll(r.re)) {
          // "total divided by count rounded": just count, or the whole sum?
          const before = q.slice(0, m.index);
          if (!BEFORE_OP.test(before)) continue;
          const sum = said(before).split(/\s+(?:and|or|is|==|!=|if|else)\s+|[(,]/).pop();
          x.err(`"${said(m[0].slice(m[1].length))}" comes after "${sum} ${said(m[1])}", so it could go with just ${code(said(m[1]))} or with all of it. Put brackets round the part you mean: (${sum} ${said(m[1])})${said(m[0].slice(m[1].length)) ? ' ' + said(m[0].slice(m[1].length)) : ''}.`);
        }
        if (r.range) for (const m of q.matchAll(r.re)) {
          if (AFTER_OP.test(q.slice(m.index + m[0].length))) x.err(`"${said(m[0])} ${said(q.slice(m.index + m[0].length).match(AFTER_OP)[0])} …" could mean a number up to ${code(said(m[2]))} and then the sum, or a number up to the whole sum. Put brackets round the end you mean, like random number from 1 to (n plus 1).`);
        }
        if (r.endsInOperand) { const out = innermostFirst(q, r); q = out.q; if (out.waiting) waiting = true; }
        else q = q.replace(r.re, r.to);
        if (q !== prev) {
          if (r.note) x.note(r.note);
          if (r.use) x.use(r.use);
        }
      } while (r.repeat && q !== prev && ++guard < 6);
      q = q.replace(/\s+/g, ' ');
    }
    }

    // 5b. "answer is "yes" or "y"": in Python `or "y"` is a test of its own (always true). With a plain name on
    //     the left, the name is said again (answer == "yes" or answer == "y"); anything else is an error.
    for (let guard = 0, m; guard < 8 && (m = q.match(EITHER)); guard++) {
      const [all, lhs, op, rhs, join, lit] = m;
      if (op === '==' && join === 'or' && /^[A-Za-z_][\w.]*(?:\[[^\]]*\])*$/.test(lhs)) {
        q = q.slice(0, m.index) + `${lhs} == ${rhs} or ${lhs} == ${lit}` + q.slice(m.index + all.length);
        x.note(`In Python, \`or\` joins two whole tests, so the name is said again: ${code(`${lhs} == … or ${lhs} == …`)}. (\`${lhs} == ${said(rhs)} or ${said(lit)}\` would always be true.)`);
        continue;
      }
      const words = { '==': 'is', '!=': 'is not', '<': 'is less than', '>': 'is more than', '<=': 'is at most', '>=': 'is at least', in: 'is in', 'not in': 'is not in' }[op];
      x.err(op === 'in' || op === 'not in'
        ?`"… ${join} ${said(lit)}" on its own is always ${join === 'or' ? 'true' : 'just that value'}, not a test. Say the whole test each time, like: list contains "a" ${join} list contains "b".`
        : `"${said(lhs)} ${words} ${said(rhs)} ${join} ${said(lit)}" could mean two things, and as Python it would test ${code(said(lit))} on its own. Say it in full: ${said(lhs)} ${words} ${said(rhs)} ${join} ${said(lhs)} ${words} ${said(lit)}.`);
      break;
    }
    // 5d. Text joined to a number ("Score: " plus score): Python needs the number turned into text first.
    //     (only a name joined on its own: in "#" * filled + "-", filled belongs to the * first)
    q = q.replace(/(⟦\d+⟧) \+ ([A-Za-z_]\w*)(?![\w.(\[])(?!\s*(?:\*\*?|\/\/?|%))|(?<![*/%] )(?<![\w.⟦])([A-Za-z_]\w*) \+ (⟦\d+⟧)/g, (all, s1, n1, n2, s2) => {
      const name = n1 || n2, str = strs[+(s1 || s2).slice(1, -1)];
      if (kindHere(x, name) !== 'number' || /^[bB]/.test(str)) return all;   // (b"…" is bytes, not text)
      x.note(`${code(name)} is a number, and Python only joins text to text, so it is turned into text first: ${code('str(' + name + ')')}.`);
      return s1 ? `${s1} + str(${name})` : `str(${name}) + ${s2}`;
    });
    // 5c. Text compared with a number is never equal: "5" is not 5.
    if (x.pass === 2) for (const m of q.matchAll(/(?<![\w.⟦])([A-Za-z_]\w*) (==|!=|<=|>=|<|>) (-?\d+(?:\.\d+)?)(?![\w.])|(?<![\w.⟦])(-?\d+(?:\.\d+)?) (==|!=|<=|>=|<|>) ([A-Za-z_]\w*)(?![\w.(])/g)) {
      const name = m[1] || m[6], num = m[3] || m[4];
      if (kindHere(x, name) === 'text') x.warn(`${code(name)} holds text${x.syms.get(name)?.asked ? ' (an answer from "ask" is always text)' : ''}, so it is never equal to the number ${num}: "${num}" and ${num} are different. Ask for a number, or turn it into one with "${name} as number".`);
    }

    // 6. Check every name.
    q = q.replace(/(?<![\w.⟦⟪])([A-Za-z_]\w*)\b(?!⟫)/g, (m, id, off, whole) => {
      if (PY_KEYWORDS.has(id) || bound.has(id)) return id;
      if (id === '_' && x.info.errs.some(e => e.startsWith('Fill in the'))) return id; // an unfilled ‹slot›, already reported
      if (/^\s*=(?!=)/.test(whole.slice(off + m.length))) return id; // keyword argument, e.g. end=""
      const low = id.toLowerCase();
      const s = x.syms.get(id);
      if (s && !(s.kind === 'class' && s.py !== id)) {   // (a class isn't found by another spelling: point is not Point)
        if (x.pass === 2 && s.scope === 'module' && FILE_ORDER[s.file] > FILE_ORDER[x.file]) {
          x.warn(`${code(s.py)} is set in ${sectionTitle(s.file)}, which this section can't see. Set it here, or pass it into the tool as an input.`);
        }
        // set only inside tools, and not this one: it doesn't exist here
        const places = Object.keys(s.kinds || {});
        if (x.pass === 2 && places.length && places.every(w => w.startsWith('fn:')) && !places.includes(scopeKey(x)) && !['function', 'class', 'module'].includes(s.kind)) {
          const tools = places.map(w => code(w.split('/').pop()));
          x.warn(`${code(s.py)} is only set inside ${tools.length > 1 ? 'the tools ' + tools.join(', ') : 'the tool ' + tools[0]}, so it doesn't exist here. To use it here, give it back from the tool ("give back ${s.py}") and store it where you run the tool.`);
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
    // two numbers side by side can't be Python ("x = 20 1"): say so here, rather than when it runs
    const pair = q.match(/(?<![\w.⟦])(\d+(?:\.\d+)?) (\d+(?:\.\d+)?)(?![\w.⟧])/);
    if (pair) x.err(`"${pair[1]} ${pair[2]}" is two numbers side by side, which isn't a value. Write one number (${pair[1]}${pair[2]}?), or join them with a word like plus.`);

    // 7. Tidy spacing. A lone = left now is a keyword argument, like end="".
    q = q.replace(/\s*(?<![=!<>])=(?!=)\s*/g, '=');
    q = q.replace(/\s+/g, ' ').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')').replace(/\s+,/g, ',').replace(/\[\s+/g, '[').replace(/\s+\]/g, ']').replace(/⟧\s+\.(?=[A-Za-z_])/g, '⟧.').trim();   // ", ".join(x) keeps its dot next to the text
    q = q.replace(/\{\s+(?=⟦)/g, '{').replace(/⟧\s+([:}])/g, '⟧$1');   // {"ok": True}, not { "ok" : True}

    // 8. Put the text back. Text with {name} inside becomes an f-string; {{ and }} are braces.
    q = q.replace(/⟦(\d+)⟧/g, (m, i, off, all) => {
      const str = strs[+i];
      if (/^[rRbBuUfF]/.test(str)) return str; // already Python (f"…", r"…"): keep exactly
      // "{x}".format(x=5): .format fills in the {…} itself (and reads {{ as a brace), so the text stays exact.
      // As an f-string the {x} would be filled first, from the x outside: 3, not 5.
      if (/^\.format(?:_map)?\b/.test(all.slice(off + m.length))) return str;
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
    if (/^f?["'].*["']\.(?:split|splitlines)\(.*\)$/.test(t)) return 'list';   // "a b c".split() is a list, not text
    if (/^[bB]["']/.test(t)) return 'bytes';   // b"…": raw bytes (a message, a file's contents), joined like text
    if (/^f?["']/.test(t) && !/["']\s*[-*/]/.test(t)) return 'text';
    if (isNum(t)) return 'number';
    if (/^\[/.test(t) || /^sorted\(/.test(t)) return 'list';
    if (/^\{/.test(t)) return 'dict';
    if (/^(True|False)$/.test(t)) return 'yesno';
    if (/^(int|float|len|sum|abs|round|random\.randint|random\.random|math\.)\b/.test(t)) return 'number';
    if (/^(str|input)\(|\.(upper|lower)\(\)$/.test(t)) return 'text';
    if (/^[A-Za-z_]\w*$/.test(t) && x.syms.has(t)) return kindHere(x, t);
    const run = t.match(/^([A-Za-z_]\w*)\(.*\)$/), ran = run && x.syms.get(run[1]);
    if (ran && ran.kind === 'function' && ran.returns) return ran.returns;   // a tool's result: what it gives back
    // lists made from other things: words.split(), list(…), a copy, the keys of a dictionary
    if (/^(?:list|sorted|reversed)\(|\.(?:split|splitlines|keys|values|items|copy)\(\)?|\.split\(/.test(t) && !/^(?:str|int|float|len)\(/.test(t)) return /\.copy\(\)$/.test(t) && x.syms.has(t.replace(/\.copy\(\)$/, '')) ? kindHere(x, t.replace(/\.copy\(\)$/, '')) : 'list';
    if (/^dict\(/.test(t)) return 'dict';
    if (/^[\w\s+\-*/%().]+$/.test(t)) {
      const ids = t.match(/[A-Za-z_]\w*/g) || [];
      if (ids.every(id => kindHere(x, id) === 'number')) return 'number';
    }
    return 'value';
  }

  /* A plain value, not a test: no "is", "contains", "not"… ("milk", total, item 0 of xs). */
  const plainValue = (p) => !/\b(?:is|isn't|are|contains?|equals?|than|not|or|even|odd|divisible|at least|at most)\b|[=<>!]/i.test(mask(p));

  /* An item picked out of a list or dictionary (room["items"], grid[r][c]): what it holds can't be known,
     unless every item put in it was the same kind (totals["food"] = 0, then totals[kind] is a number). */
  const pickedOut = (t) => /^[A-Za-z_][\w.]*(?:\[[^\]]*\])+$/.test(t);
  function itemKind(t, x) {
    const m = t.match(/^([A-Za-z_]\w*)\[[^\]]*\]$/), s = m && x.syms.get(m[1]);
    return s && s.items && s.items.size === 1 && !s.items.has('value') ? [...s.items][0] : 'value';
  }

  const KIND_WORDS = { number: 'a number', text: 'text', bytes: 'bytes', list: 'a list', dict: 'a dictionary', yesno: 'a yes/no value', function: 'a tool', value: 'a value' };

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
      const k = kindHere(x, coll);
      x.note(k === 'dict' ? `${code(coll + '[' + key + ']')} stores the value under the key ${code(key)} in the dictionary.` : `${code(coll + '[' + key + ']')} replaces one item. Positions start at 0.`);
      return { py: `${coll}[${key}]`, coll };
    }
    if ((m = target.match(/^(?:the\s+)?(first|last)\s+item\s+(?:of|in)\s+(.+)$/i))) {
      const coll = tExpr(m[2], x);
      return { py: `${coll}[${m[1].toLowerCase() === 'first' ? 0 : -1}]` };
    }
    return null;
  }

  function doSet(nameRaw, valueRaw, x, verb) {
    let value;
    const call = qmatch(valueRaw, /^(?:the\s+)?(?:result|answer|output) of\s+(.+?)(?:\s+(?:with|using|on)\s+(.+))?$/i);
    // "a new Flask with __name__": an object made from a class (Python writes it as a call)
    const made = !call && qmatch(valueRaw, /^(?:an?\s+)?new\s+([A-Za-z_][\w.]*)(?:\s+(?:with|using|from)\s+(.+))?$/i);
    if (call) value = callExpr(call[1], call[2], x);
    else if (made) { value = callExpr(made[1], made[2], x); x.note(`Makes a new ${code(made[1])} object. Python writes this as a call, like running a tool.`); }
    else value = tExpr(valueRaw, x);
    // "set count, sides to …": several names at once, one for each value (unpacking)
    const many = splitItems(nameRaw, false);
    if (many.length > 1 && /,/.test(mask(nameRaw)) && many.every(n => /^[A-Za-z_][\w ]*$/.test(n.trim()))) {
      const pys = many.map(n => toName(n, x, { define: true }));
      pys.forEach((py, i) => { declare(x, py, many[i].trim(), 'value'); assigned(x, py); });
      x.note(`The value holds ${pys.length} values, so they are unpacked: one into each of ${pys.map(code).join(', ')}.`);
      return { py: `${pys.join(', ')} = ${value}` };
    }
    const tgt = setTarget(nameRaw, x);
    if (tgt) {
      // what the items put in a dictionary or list hold, so "add 1 to totals[kind]" knows they're numbers
      const cs = tgt.coll && x.syms.get(tgt.coll);
      if (cs) (cs.items = cs.items || new Set()).add(kindOf(value, x));
      return { py: `${tgt.py} = ${value}` };
    }
    if (/^[A-Za-z_]\w*(\.[A-Za-z_]\w*)+$/.test(nameRaw.trim())) {
      // what an object's own value holds (self.items = [] in a class), so "add item to self.items" appends
      if (/^self\.[A-Za-z_]\w*$/.test(nameRaw.trim())) {
        const attrs = x.env.attrs = x.env.attrs || new Map(), key = `${x.file}:${nameRaw.trim()}`, had = attrs.get(key), kind = kindOf(value, x);
        if (!had || had === 'value') attrs.set(key, kind);
        else if (kind !== 'value' && kind !== had) attrs.set(key, 'mixed');
      }
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
    const picked = !dotted && /^[A-Za-z_]\w*(?:\.[A-Za-z_]\w*|\[[^\]]+\])*\[[^\]]+\](?:\.[A-Za-z_]\w*)*$/.test(raw);   // a tool kept in a list or dictionary: verbs[verb]
    const fnName = dotted ? raw : picked ? tExpr(raw, x) : toName(nameRaw, x);
    const s = dotted || picked ? null : x.syms.get(fnName);
    const args = argsRaw && !/^nothing$/i.test(argsRaw.trim()) ? splitItems(argsRaw).map(a => tExpr(a, x)) : [];
    const keywords = args.some(a => /^[A-Za-z_]\w*=/.test(a));
    if (picked) {
      x.note(`Runs the tool kept in ${code(fnName)}: square brackets pick it out, then the round brackets run it.`);
    } else if (dotted) {
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
    const a = py.match(/^\s*([A-Za-z_]\w*)\s*=(?!=)\s*(.*)$/);
    if (a) declare(x, a[1], a[1], kindOf(a[2].replace(/\s*#.*$/, ''), x));   // what it holds, from the value's shape (names = [] is a list)
    const imp = py.match(/^\s*(?:from\s+[\w.]+\s+)?import\s+(.+)$/);
    if (imp) for (const part of imp[1].replace(/[()]/g, '').split(',')) {
      const nm = part.trim().split(/\s+as\s+/).pop().split('.')[0];
      if (/^[A-Za-z_]\w*$/.test(nm)) declare(x, nm, nm, /^\s*import/.test(py) ? 'module' : 'value');
    }
    const cls = py.match(/^\s*class\s+([A-Za-z_]\w*)/);
    if (cls) declare(x, cls[1], cls[1], 'class');
    const d = py.match(/^\s*def\s+([A-Za-z_]\w*)\s*\(([^)]*)\)/);
    if (d) {
      const ps = d[2].split(',').map(p => p.trim()).filter(Boolean);
      // inputs with a value to use when none is given (h=1) can be left out when the tool is run
      // (*args takes any number, so then the inputs aren't counted)
      declare(x, d[1], d[1], 'function', ps.some(p => p.startsWith('*')) ? {} : { params: ps.map(p => p.replace(/[:=].*$/, '').trim()), required: ps.filter(p => !/=/.test(p)).length });
      // its inputs are names inside it, for the sentences under it
      for (const p of ps) { const nm = p.replace(/^\*{1,2}/, '').replace(/[:=].*$/, '').trim(); if (/^[A-Za-z_]\w*$/.test(nm)) declare(x, nm, nm, 'value'); }
    }
    // names a block line makes: for x in …, with … as f, except E as e
    const made = py.match(/^\s*(?:async\s+)?for\s+(.+?)\s+in\s/) || py.match(/\bas\s+([A-Za-z_]\w*)\s*:\s*(?:#.*)?$/);
    if (made) for (const nm of made[1].replace(/[()]/g, '').split(',').map(n => n.trim())) if (/^[A-Za-z_]\w*$/.test(nm)) declare(x, nm, nm, 'value');
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

  /* Imports in words: "bring in os and sys", "bring in tkinter as tk", "bring in Flask and jsonify from flask",
     "bring in everything from math" (import *), "bring in views from this package" (from . import views). */
  rule(/^bring in\s+(.+?)(?:\s+from\s+(this package|\.+[A-Za-z_][\w.]*|\.{2,}|[A-Za-z_][\w.]*))?$/i, (m, x) => {
    const from = m[2] && (/^this package$/i.test(m[2]) ? '.' : m[2]);
    const items = splitItems(m[1]);
    if (from && items.length === 1 && /^everything$/i.test(items[0])) {
      x.note(`\`from ${from} import *\` brings in every public name ${code(from)} has, so they can be used without ${code(from + '.')} in front.`);
      return { py: `from ${from} import *` };
    }
    const parts = [];
    for (const it of items) {
      const p = it.match(from ? /^([A-Za-z_]\w*)(?:\s+as\s+([A-Za-z_]\w*))?$/ : /^([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)(?:\s+as\s+([A-Za-z_]\w*))?$/);
      if (!p || PY_KEYWORDS.has(p[1]) || (p[2] && PY_KEYWORDS.has(p[2]))) { x.err(`"${it}" can't be brought in: say a ${from ? 'name' : 'module'}, like ${from ? '"bring in sqrt from math"' : '"bring in random"'}, with "as" for another name.`); continue; }
      const bound = p[2] || (from ? p[1] : p[1].split('.')[0]);
      declare(x, bound, bound, from ? 'value' : 'module');
      parts.push(p[1] + (p[2] ? ' as ' + p[2] : ''));
    }
    if (!parts.length) return { py: '# ??? ' + m.input };
    x.note(from ? `\`from ${from} import …\` brings in ${parts.map(code).join(', ')} from ${code(from)}, so ${parts.length > 1 ? 'they' : 'it'} can be used by name.`
      : `\`import\` loads ${parts.map(code).join(', ')}, so ${parts.length > 1 ? 'their' : 'its'} tools can be used${parts.some(p => / as /.test(p)) ? ' (by the name after "as")' : ''}.`);
    return { py: from ? `from ${from} import ${parts.join(', ')}` : `import ${parts.join(', ')}` };
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
    return { py: `class ${m[1]}${bases.length ? `(${bases.join(', ')})` : ''}:`, open: 'class', cls: m[1] };
  });
  // the setting-up tool of a class: "when a new Account is made with owner, balance=0" -> def __init__(self, owner, balance=0):
  rule(/^when\s+an?\s+new\s+([A-Za-z_]\w*)\s+is\s+(?:made|created)(?:\s+(?:with|from|using)\s+(.+))?$/i, (m, x) => {
    const here = x.stack[x.stack.length - 1] || {};
    if (here.type !== 'class') x.err(`"when a new ${m[1]} is made" sets up each new object of a class, so it goes right inside "define class ${m[1]}".`);
    else if (here.cls && here.cls !== m[1]) x.err(`This is inside the class ${code(here.cls)}, so it's "when a new ${here.cls} is made".`);
    const parts = m[2] ? splitItems(m[2]) : [];
    const params = ['self'], shown = ['self'];
    for (const p of parts) {
      const d = p.match(/^([A-Za-z_]\w*)\s*(?::\s*(.+?))?\s*(?:=\s*(.+))?$/) || [null, p];
      const pn = toName(d[1], x, { define: true, param: true });
      params.push(pn);
      shown.push(pn + (d[2] ? `: ${tExpr(d[2], x)}` : '') + (d[3] ? (d[2] ? ' = ' : '=') + tExpr(d[3], x) : ''));
    }
    declare(x, '__init__', '__init__', 'function', { params, required: 1 + parts.filter(p => !/=(?!=)/.test(p)).length });
    for (const p of params) declare(x, p, p, 'value', { scope: 'local', where: `fn:${x.file}/__init__` });
    x.note('`__init__` sets up each new object as it is made: Python runs it when you make one, with the inputs given then. `self` is the new object itself.');
    return { py: `def __init__(${shown.join(', ')}):`, open: 'def', fn: { name: '__init__', params } };
  });
  /* Kinds of value in sentences -> Python types (as cpp_write.js does for C++). Only in lower case, so
     Decimal (from the decimal module) stays Decimal, and a class of the program's own keeps its name. */
  const KIND_TYPES = { number: 'int', numbers: 'int', 'whole number': 'int', 'whole numbers': 'int', decimal: 'float', decimals: 'float', text: 'str', words: 'str', 'yes/no': 'bool', character: 'str', characters: 'str' };
  function kindType(word, x) {
    const w = word.trim().replace(/\s*\/\s*/g, '/').replace(/\s+/g, ' ');
    if ((x.syms.map.get(w) || {}).kind === 'class') return null;
    const list = w.match(/^list of (.+)$/);
    if (list) return KIND_TYPES[list[1]] ? `list[${KIND_TYPES[list[1]]}]` : null;
    return KIND_TYPES[w] || null;
  }
  rule(/^field\s+([A-Za-z_]\w*)\s*:\s*(.+?)(?:\s+=\s+(.+))?$/i, (m, x) => {
    declare(x, m[1], m[1], 'value');
    const kind = kindType(m[2], x);
    x.note(`Declares that objects of this class have ${code(m[1])}, of type ${code(kind || m[2].trim())}` + (kind ? ` (Python's word for ${m[2].trim()}).` : '.') + (m[3] ? ' If none is given, it starts as ' + code(m[3].trim()) + '.' : ''));
    return { py: `${m[1]}: ${kind || tExpr(m[2], x)}${m[3] ? ' = ' + tExpr(m[3], x) : ''}` };
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
  rule(/^open\s+(?:the\s+)?(?:file\s+)?(.+?)(?:\s+for\s+(reading|writing|adding|appending))?(?:\s+with\s+(.+?))?\s+as\s+([A-Za-z_]\w*)$/i, (m, x) => {
    const mode = { reading: 'r', writing: 'w', adding: 'a', appending: 'a' }[(m[2] || '').toLowerCase()];
    declare(x, m[4], m[4], 'value');
    const extra = m[3] ? splitItems(m[3]).map(a => tExpr(a, x)) : [];
    x.note(`\`with open(…)\` opens the file and closes it automatically when the indented lines finish.` + (mode === 'w' ? ' Writing replaces whatever was in the file.' : mode === 'a' ? ' Adding writes to the end and keeps what was there.' : '') + (extra.length ? ` ${extra.map(code).join(', ')} ${extra.length > 1 ? 'are' : 'is'} given to \`open\` as well.` : ''));
    return { py: `with open(${[tExpr(m[1], x), ...(mode ? [`"${mode}"`] : []), ...extra].join(', ')}) as ${m[4]}:`, open: 'block' };
  });
  // files, JSON and databases
  rule(/^save\s+(.+?)\s+as\s+JSON\s+(?:in|into)\s+(.+?)(?:\s+with\s+(.+))?$/i, (m, x) => {
    x.use('json');
    const extra = m[3] ? splitItems(m[3]).map(a => tExpr(a, x)) : [];
    x.note('`json.dump(value, file)` writes the value into the open file as JSON text.');
    return { py: `json.dump(${[tExpr(m[1], x), tExpr(m[2], x), ...extra].join(', ')})` };
  });
  rule(/^write\s+(.+?)\s+into\s+([A-Za-z_][\w.]*)$/i, (m, x) => {
    x.note('`.write()` writes the text into the open file (or anything else that can be written to). It adds no new line by itself.');
    return { py: `${m[2]}.write(${tExpr(m[1], x)})` };
  });
  rule(/^save the changes (?:to|in) ([A-Za-z_][\w.]*)$/i, (m, x) => {
    x.note('`.commit()` makes the changes since the last commit permanent in the database.');
    return { py: `${m[1]}.commit()` };
  });
  rule(/^run (?:the )?SQL\s+(.+?)\s+on\s+([A-Za-z_][\w.]*)(?:\s+with\s+(the\s+values?\s+)?(.+))?$/i, (m, x) => {
    const sql = tExpr(m[1], x);
    let rest = '';
    if (m[4]) {
      const vals = splitItems(m[4]).map(a => tExpr(a, x));
      rest = m[3] ? `, (${vals.join(', ')}${vals.length === 1 ? ',' : ''})` : `, ${vals.join(', ')}`;
    }
    x.note('`.execute()` runs the SQL command on the database.' + (m[3] ? ' The values fill in its ? marks, in order; passed this way they can\'t change the command itself.' : ''));
    return { py: `${m[2]}.execute(${sql}${rest})` };
  });
  /* A window part (tkinter and the like), made and placed in one line:
     "add a tk.Button saying "Add" to root that runs self.add_task, packed with pady=5"
       -> tk.Button(root, text="Add", command=self.add_task).pack(pady=5) */
  rule(/^add an?\s+((?:[A-Za-z_]\w*\.)*[A-Z]\w*)(?:\s+saying\s+(.+?))?\s+to\s+([A-Za-z_][\w.]*)(?:\s+that runs\s+(.+?))?(?:\s+with\s+(.+?))?(?:,?\s+(packed|put in the grid|placed)(?:\s+with\s+(.+))?)?$/i, (m, x) => {
    const args = [tExpr(m[3], x)];
    if (m[2]) args.push(`text=${tExpr(m[2], x)}`);
    if (m[4]) args.push(`command=${tExpr(m[4], x)}`);
    if (m[5]) args.push(...splitItems(m[5]).map(a => tExpr(a, x)));
    const how = { packed: 'pack', 'put in the grid': 'grid', placed: 'place' }[(m[6] || 'packed').toLowerCase()];
    const place = m[7] ? splitItems(m[7]).map(a => tExpr(a, x)) : [];
    x.note(`Makes a ${code(m[1])} inside ${code(args[0])} and places it with ${code('.' + how + '()')}, all in one line.` + (m[4] ? ` Clicking it runs ${code(tExpr(m[4], x))}.` : ''));
    return { py: `${callExpr(m[1], null, x).replace(/\(\)$/, '')}(${args.join(', ')}).${how}(${place.join(', ')})` };
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
      const pn = toName(d[1], x, { define: true, param: true });
      params.push(pn);
      shown.push(pn + (d[2] ? `: ${tExpr(d[2], x)}` : '') + (d[3] ? (d[2] ? ' = ' : '=') + tExpr(d[3], x) : ''));
    }
    const required = parts.filter(p => !/=(?!=)/.test(p)).length;
    declare(x, name, m[2], 'function', { params, required });
    for (const p of params) declare(x, p, p, 'value', { scope: 'local', where: `fn:${x.file}/${name}` });   // the tool's own inputs
    if (x.level > 0 && !x.inside('class')) x.warn('This tool is defined inside another block. Usually tools are defined at the left edge, with nothing in front.');
    x.note(`${code(m[1] ? 'async def' : 'def')} makes a reusable tool called ${code(name)}. The indented lines under it only run when you "run ${m[2].trim()}".` + (params.length ? ` Its inputs (${params.map(code).join(', ')}) are filled in each time it runs.` : '') + (required < params.length ? ' Inputs with `=` have a value to use if none is given.' : '') + (m[1] ? ' `async` means it can wait for slow things (like the internet) without blocking.' : ''));
    return { py: `${m[1] ? 'async ' : ''}def ${name}(${shown.join(', ')}):`, open: 'def', fn: { name, params } };
  });

  rule(/^(?:give back|return|send back|answer with|hand back)\b\s*(.*)$/i, (m, x) => {
    if (!x.inside('def')) x.err('"give back" only works inside a tool (a define block). It hands a result back to whoever ran the tool.');
    x.note('`return` ends the tool and hands this value back to the line that ran it.');
    // "give back total and count": two values, or "total and count" (a yes/no test)? Plain values joined by "and" are asked about.
    const parts = m[1] ? splitItems(m[1]) : [];
    if (parts.length > 1 && /\band\b/i.test(mask(m[1])) && !/,/.test(mask(m[1])) && parts.every(plainValue)) {
      x.err(`"give back ${m[1].trim()}" could mean two values, or a yes/no test that both are true. For two values, separate them with a comma: give back ${parts.join(', ')}.`);
    }
    const value = m[1] ? tExpr(m[1], x) : '';
    // what the tool gives back, so a name that stores its result knows what it holds (a mix is "can't tell")
    const fs = x.fn && x.syms.get(x.fn.name);
    if (fs && value) { const k = kindOf(value, x); fs.returns = !fs.returns || fs.returns === k ? k : 'value'; }
    return { py: value ? `return ${value}` : 'return', tag: 'return' };
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
  rule(/^(?:count(?: down| up)?|for(?: each| every)?)(?:\s+(.+?))?\s+from\s+(.+?)\s+(down\s+)?to\s+(.+?)(?:\s+(?:in steps of|by|step|stepping by)\s+(.+))?$/i, (m, x) => {
    if (!m[1] || /^(?:down|up)$/i.test(m[1])) {
      m[1] = 'n';
      x.note('No name was given for the count, so it is called `n`. Write "count i from …" to choose a name.');
    }
    // "for each x in numbers from 1 to 2" mixes two sentences
    if (/\s(?:in|of)\s/i.test(m[1])) { x.err(`This mixes two sentences. To go through a list, say "for each ${m[1].split(/\s+(?:in|of)\s+/i)[0]} in ${m[1].split(/\s+(?:in|of)\s+/i)[1]}"; to count, say "count ${m[1].split(/\s+(?:in|of)\s+/i)[0]} from ${m[2]} to ${m[4]}".`); return { py: '# ??? ' + m.input, open: 'loop' }; }
    const v = toName(m[1], x, { define: true });
    declare(x, v, m[1], 'number');
    const a = tExpr(m[2], x), b = tExpr(m[4], x);
    const step = m[5] ? tExpr(m[5], x) : null;
    const up = /^count up/i.test(m.input);
    const down = !up && (!!m[3] || /^count down/i.test(m.input) || (isNum(a) && isNum(b) && +a > +b));
    // "count i from n to 1": which way? Only numbers written here say; otherwise ask (never count the wrong way)
    if (!up && !down && !isNum(a) && isNum(b)) x.err(`IntuaCode can't tell which way this counts, because ${code(a)} isn't a number written here. Say "count up from …" or "count down from …".`);
    let end, st = step;
    if (down) {
      end = isNum(b) ? String(+b - 1) : `${b} - 1`;
      st = step ? (isNum(step) ? String(-Math.abs(+step)) : /^[\w.]+$/.test(step) ? `-${step}` : `-(${step})`) : '-1';
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
    const ck = kindHere(x, coll);
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
    // "then show 1 otherwise show 2" on one line: "otherwise" starts a step of its own
    if (/\botherwise\s+(?:show|print|say|display|set|add|run|ask|give back|stop)\b/i.test(mask(m[1]))) x.err('"otherwise" starts a step of its own here. Put it on its own line, lined up with the "if", and the step under it.');
    // "and" between things to show shows each; between tests ("a is 1 and b is 2") it is one yes/no test
    let parts = splitItems(m[1]);
    if (parts.length > 1 && !parts.every(plainValue)) parts = splitItems(m[1], false);
    const items = parts.map(p => tExpr(p, x));
    if (items.length > 1) x.note('Several things separated by "and" or commas are shown on one line, with a space between each.');
    if (m[2]) x.note('`end=" "` stops `print` moving to a new line, so the next thing shown continues on this line.');
    return { py: `print(${items.join(', ')}${m[2] ? ', end=" "' : ''})` };
  });
  rule(/^ask(?:\s+(?:for|the user for|them for))?(?:\s+(?:an?\s+)?(whole number|number|decimal(?: number)?|text|word|answer|name))?(?:\s+(.+?))?\s+(?:and\s+)?(?:store|save|keep|put|remember)(?:\s+(?:it|that|the answer|the reply))?\s+(?:in|as|into)\s+(.+?)(?:\s+as\s+(?:an?\s+)?(whole number|number|decimal(?: number)?|text))?$/i, (m, x) => {
    const kindWord = (m[1] || m[4] || '').toLowerCase();   // "ask for a number …" or "… and store in age as a number"
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
    if (kind === 'text') x.syms.get(name).asked = true;   // (so a comparison with a number can say why it never matches)
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
  // the list tools with words of their own, whatever the name holds
  rule(/^add\s+(?:each|every)\s+item\s+(?:of|in|from)\s+(.+?)\s+to\s+(?:the\s+end\s+of\s+)?(.+)$/i, (m, x) => {
    const target = tExpr(m[2], x);
    x.note('`.extend()` adds each item of the other list to the end of this one.');
    return { py: `${target}.extend(${tExpr(m[1], x)})` };
  });
  rule(/^add\s+(.+?)\s+to\s+the\s+set\s+(.+)$/i, (m, x) => {
    const target = tExpr(m[2], x);
    x.note('`.add()` puts the value into the set. A set keeps each value only once.');
    return { py: `${target}.add(${tExpr(m[1], x)})` };
  });
  rule(/^insert\s+(.+?)\s+(?:into|in)\s+(.+?)\s+at\s+(?:position\s+)?(.+)$/i, (m, x) => {
    const target = tExpr(m[2], x);
    x.note('`.insert(position, value)` puts the value in at that position; the ones after it move along. Positions start at 0.');
    return { py: `${target}.insert(${tExpr(m[3], x)}, ${tExpr(m[1], x)})` };
  });
  rule(/^take\s+(?:the\s+)?last\s+item\s+out\s+of\s+(.+)$/i, (m, x) => {
    x.note('`.pop()` takes the last item out of the list.');
    return { py: `${tExpr(m[1], x)}.pop()` };
  });
  rule(/^take\s+item\s+(\S+)\s+out\s+of\s+(.+)$/i, (m, x) => {
    x.note('`.pop(n)` takes out the item at that position (or under that key). Positions start at 0.');
    return { py: `${tExpr(m[2], x)}.pop(${tExpr(m[1], x)})` };
  });
  rule(/^take\s+(.+?)\s+out\s+of\s+(.+)$/i, (m, x) => {
    x.note('`.remove()` takes out the first matching item. If it isn\'t there, Python stops with an error.');
    return { py: `${tExpr(m[2], x)}.remove(${tExpr(m[1], x)})` };
  });
  rule(/^(add|append|put)\s+(.+?)\s+(?:to|onto|into)\s+(?:the\s+end\s+of\s+)?(.+)$/i, (m, x) => {
    const target = tExpr(m[3], x);
    // "append" always puts the value on the end of a list, whatever can be seen of the name
    if (m[1].toLowerCase() === 'append') {
      x.note(`"append" puts ${code(tExpr(m[2], x))} on the end of the list with ${code('.append()')}.`);
      return { py: `${target}.append(${tExpr(m[2], x)})` };
    }
    const s = x.syms.get(target), own = /^[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)+$/.test(target);   // (an object's value: set in another tool, or by the class it builds on)
    const k = s ? kindHere(x, target) : pickedOut(target) ? itemKind(target, x) : own ? kindHere(x, target) : undefined;
    // "put 0 into count" stores a value; "put "milk" into basket" adds to a list
    if (m[1].toLowerCase() === 'put' && k !== 'list' && !pickedOut(target)) return doSet(m[3], m[2], x);
    if (x.pass === 2 && !s && !pickedOut(target) && !own) { x.err(`${code(target)} doesn't exist yet. Create it first, e.g. "set ${m[3].trim()} to 0" or "create list ${m[3].trim()}".`); }
    if (k === 'dict') { x.err('To add to a dictionary, give the key: set item "key" of ' + target + ' to value.'); return { py: `${target}` }; }
    // several things at once: "add "milk" and "eggs" to basket" adds both
    const parts = splitItems(m[2]);
    const many = parts.length > 1 && parts.every(plainValue);
    const vals = many ? parts.map(p => tExpr(p, x)) : [tExpr(m[2], x)];
    const val = vals[0];
    const appends = () => (many ? { py: `${target}.append(${vals[0]})`, pys: vals.map(v => `${target}.append(${v})`) } : { py: `${target}.append(${val})` });
    if (k === 'list') {
      x.note(`${code(target)} is a list, so "add" puts ${many ? 'each one' : code(val)} on the end with ${code('.append()')}.`);
      return appends();
    }
    // what it holds can't be seen (taken out of something else, made by a tool, a python: line…)
    if (!['text', 'bytes', 'number', 'yesno'].includes(k)) {
      const vk = vals.map(v => kindOf(v, x));
      if (vk.some(v => ['text', 'list', 'dict', 'yesno'].includes(v))) {
        x.note(`The translator can't see what ${code(target)} holds. Adding ${many ? 'these' : code(val)}, which ${many ? "aren't numbers" : "isn't a number"}, means it's a list, so ${code('.append()')} puts ${many ? 'each one' : 'it'} on the end. (If ${code(target)} is text, Python stops with an error here: write "set ${m[3].trim()} to ${m[3].trim()} plus …" to join text.)`);
        return appends();
      }
      if (many) { x.err(`Add one number at a time to ${code(target)}, or add them up first: add ${parts.join(' plus ')} to ${m[3].trim()}.`); return { py: `${target} += ${val}` }; }
      assigned(x, target, true);
      // a number, or nothing known about either side: += (if it's really a list and the value text, Python would add each letter)
      if (k === 'mixed') x.warn(`${code(target)} holds different kinds of value in different places (a number in one, a list in another…), so it can't be told what "add" should do here: this adds as for a number (\`+=\`). If it holds a list here, write "append ${m[2].trim()} to ${m[3].trim()}".`);
      else if (vk.every(v => v === 'number')) x.note(`The translator can't see what ${code(target)} holds, so \`+=\` adds ${code(val)} to it, as for a number. If it holds a list, write "append ${m[2].trim()} to ${m[3].trim()}".`);
      else x.warn(`The translator can't tell what ${code(target)} or ${code(val)} hold, so this adds them as numbers (\`+=\`). If ${code(target)} is a list, write "append ${m[2].trim()} to ${m[3].trim()}" instead: \`+=\` would add text to a list letter by letter.`);
      return { py: `${target} += ${val}` };
    }
    if (many) { x.err(`${code(target)} is ${KIND_WORDS[k]}, so add one thing at a time, or join them first: add ${parts.join(' plus ')} to ${m[3].trim()}.`); return { py: `${target} += ${val}` }; }
    assigned(x, target, true);
    if (k === 'text' || k === 'bytes') x.note(`${code(target)} is ${k}, so "add" joins ${code(val)} onto the end. \`+=\` is short for ${code(target + ' = ' + target + ' + ' + val)}.`);
    else x.note(`${code(target)} is ${KIND_WORDS[k] || 'a value'}, so "add" increases it with \`+=\` (short for ${code(target + ' = ' + target + ' + ' + val)}). If it were a list, this would use \`.append()\` instead.`);
    return { py: `${target} += ${val}` };
  });
  rule(/^(?:remove|delete)\s+(.+?)\s+from\s+(.+)$/i, (m, x) => {
    const target = tExpr(m[2], x);
    const k = kindHere(x, target);
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
    // several things at once: "remove "milk" and "jam" from basket" takes out both
    const parts = splitItems(m[1]);
    const many = parts.length > 1 && parts.every(plainValue);
    const vals = many ? parts.map(p => tExpr(p, x)) : [tExpr(m[1], x)];
    const val = vals[0];
    if (k === 'list' || (!k && pickedOut(target) && kindOf(val, x) !== 'number')) {
      if (k !== 'list') x.note(`${code(target)} is taken out of something else, so the translator can't see what it holds. Taking out ${code(val)}, which isn't a number, means it's a list. (To take a number away from a number in there, write "decrease ${m[2].trim()} by …".)`);
      x.note('`.remove()` takes out the first matching item. If it isn\'t in the list, Python stops with an error, so you might check with "if … is in …" first.');
      return many ? { py: `${target}.remove(${val})`, pys: vals.map(v => `${target}.remove(${v})`) } : { py: `${target}.remove(${val})` };
    }
    if (many) { x.err(`${code(target)} is ${KIND_WORDS[k] || 'a value'}, not a list, so take away one thing at a time.`); return { py: `${target} -= ${val}` }; }
    assigned(x, target, true);
    x.note(`${code(target)} is ${KIND_WORDS[k] || 'a value'}, so "remove" subtracts with \`-=\`.`);
    return { py: `${target} -= ${val}` };
  });
  rule(/^(?:subtract|take away|take)\s+(.+?)\s+from\s+(.+)$/i, (m, x) => {
    const target = tExpr(m[2], x); assigned(x, target, true);
    x.note(`\`-=\` is short for ${code(target + ' = ' + target + ' - …')}.`);
    return { py: `${target} -= ${tExpr(m[1], x)}` };
  });
  rule(/^(?:increase|raise|increment|bump up|go up)\s+(.+?)(?:\s+by\s+(.+))?$/i, (m, x) => {
    const target = tExpr(m[1], x); assigned(x, target, true);
    const by = m[2] ? tExpr(m[2], x) : '1';
    if (!m[2]) x.note('No amount given, so it goes up by 1.');
    x.note(`\`+=\` is short for ${code(target + ' = ' + target + ' + ' + by)}.`);
    return { py: `${target} += ${by}` };
  });
  rule(/^(?:decrease|lower|reduce|decrement|go down)\s+(.+?)(?:\s+by\s+(.+))?$/i, (m, x) => {
    const target = tExpr(m[1], x); assigned(x, target, true);
    const by = m[2] ? tExpr(m[2], x) : '1';
    if (!m[2]) x.note('No amount given, so it goes down by 1.');
    x.note(`\`-=\` is short for ${code(target + ' = ' + target + ' - ' + by)}.`);
    return { py: `${target} -= ${by}` };
  });
  rule(/^multiply\s+(.+?)\s+by\s+(.+)$/i, (m, x) => {
    const t = tExpr(m[1], x); assigned(x, t, true);
    return { py: `${t} *= ${tExpr(m[2], x)}` };
  });
  rule(/^divide\s+(.+?)\s+by\s+(.+)$/i, (m, x) => {
    const t = tExpr(m[1], x); assigned(x, t, true);
    x.note('`/=` divides and always leaves a decimal number, even 10 / 2 gives 5.0.');
    return { py: `${t} /= ${tExpr(m[2], x)}` };
  });
  rule(/^sort\s+(.+?)\s+by\s+(.+?)(\s+(?:backwards|in reverse|biggest first|largest first|highest first|descending))?$/i, (m, x) => {
    x.note('`.sort(key=…)` puts the list in order of what the key tool gives for each item.' + (m[3] ? ' `reverse=True` puts the biggest first.' : ''));
    return { py: `${tExpr(m[1], x)}.sort(key=${tExpr(m[2], x)}${m[3] ? ', reverse=True' : ''})` };
  });
  rule(/^(sort|reverse|shuffle|empty|clear)\s+(.+?)(\s+(?:backwards|in reverse|biggest first|largest first|highest first|descending))?$/i, (m, x) => {
    const verb = m[1].toLowerCase();
    const t = tExpr(m[2], x);
    if (x.pass === 2 && x.syms.get(t) && !['list', 'value', 'dict'].includes(kindHere(x, t))) x.warn(`${code(t)} doesn't look like a list.`);
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
  // made and not kept: the object does its work as it is made (a window's app, a thread that starts itself…)
  rule(/^(?:make|create)\s+(?:a\s+)?new\s+([A-Za-z_][\w.]*)(?:\s+(?:with|using|from)\s+(.+))?$/i, (m, x) => {
    x.note(`Makes a new ${code(m[1])} object without keeping it. Python writes this as a call, like running a tool.`);
    return { py: callExpr(m[1], m[2], x) };
  });

  // --- Storing -------------------------------------------------------------
  rule(/^(?:set|make|let|change|update)\s+(.+?)\s+(?:to be|to|be|equal to|equal|=)\s+(.+)$/i, (m, x) => doSet(m[1], m[2], x));
  // the last "as", "in" or "into" says where: "store score as text in label" stores score as text in label
  rule(/^(?:remember|store|save|keep)\s+(.+)\s+(?:as|in|into)\s+(.+?)$/i, (m, x) => doSet(m[2], m[1], x));

  // --- Running tools ---------------------------------------------------------
  rule(/^(?:run|call|do|use|perform)\s+(?:the\s+)?(?:tool\s+)?(.+?)(?:\s+(?:with|using|on|for)\s+(.+?))?(?:\s+and\s+(?:store|save|keep|put|remember)(?:\s+(?:it|the result|the answer|what it gives back))?\s+(?:in|as|into)\s+(.+))?$/i, (m, x) => {
    // A tool whose name has "for", "on" or "with" in it ("run look for with …") keeps its whole name.
    const said = m.input.replace(/^(?:run|call|do|use|perform)\s+(?:the\s+)?(?:tool\s+)?/i, '');
    for (const t of [...x.syms.values()].filter(v => v.kind === 'function' && /\s/.test(v.display)).sort((a, b) => b.display.length - a.display.length)) {
      const longer = t.display.split(/\s+/).length > m[1].trim().split(/\s+/).length;
      const after = longer && said.toLowerCase().startsWith(t.display) ? said.slice(t.display.length) : null;
      if (after != null && (!after || /^\s+(?:with|using|on|for|and)\s/i.test(after))) {
        const r = qmatch(after, /^(?:\s+(?:with|using|on|for)\s+(.+?))?(?:\s+and\s+(?:store|save|keep|put|remember)(?:\s+(?:it|the result|the answer|what it gives back))?\s+(?:in|as|into)\s+(.+))?$/i);
        if (r) { m = [m[0], said.slice(0, t.display.length), r[1], r[2]]; break; }
      }
    }
    const call = callExpr(m[1], m[2], x);
    if (m[3]) {
      const v = toName(m[3], x, { define: true });
      declare(x, v, m[3], kindOf(call, x)); assigned(x, v);   // (what the tool gives back, when that's known)
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
    assigned(x, py, m[2] !== '=');
    x.note('This is already Python, so it is kept almost as written.');
    return { py: `${py} ${m[2]} ${tExpr(m[3], x)}` };
  });

  const STARTERS = ['set', 'show', 'ask', 'if', 'otherwise', 'repeat', 'while', 'count', 'for each', 'define', 'give back', 'run', 'add', 'remove', 'increase', 'decrease', 'create list', 'sort', 'wait', 'note', 'python', 'stop the loop', 'skip to next', 'multiply', 'divide', 'remember', 'use'];

  /* ------------------------------------------------------------------ */
  /* Filler words, and several steps in one sentence                     */
  /* ------------------------------------------------------------------ */

  // Natural phrasing is never penalised: these words are left out, and the explain strip says so.
  const LEAD_FILLER = /^(?:(?:please|kindly|ok|okay|so|and|now|next|then|and then|also|just|simply|finally|first(?:ly)?|after that|afterwards|i want to|i'd like to|i would like to|i need to|we need to|we want to|let's|let us|can you|could you|you should|go ahead and|make sure (?:to|you)|remember to|be sure to)\s*,?\s+)+/i;
  const ANY_FILLER = /\b(?:please|kindly|just|simply|basically|really|actually|quickly)\b/gi;
  const TAIL_FILLER = /(?:\s*,?\s*\b(?:please|for me|thanks|thank you))+\s*[.!]?\s*$/i;
  // after "run …", "for me" is the tool's input ("run greet for me"), not filler
  const TAIL_FILLER_RUN = /(?:\s*,?\s*\b(?:please|thanks|thank you))+\s*[.!]?\s*$/i;
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
    const tail = mask(s).match(/^(?:run|call|do|use|perform)\b/i.test(s) ? TAIL_FILLER_RUN : TAIL_FILLER);
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
    // "1,000" is two values in Python (1 and 0), so a number is written without its commas
    const ms = mask(s), depthAt = (i) => [...ms.slice(0, i)].reduce((d, c) => d + ('([{'.includes(c)) - (')]}'.includes(c)), 0);
    const big = [...ms.matchAll(/(?<![\w.,])\d{1,3}(?:,\d{3})+(?![\w.,])/g)].find(b => !depthAt(b.index));   // (inside brackets it's Python's own [100,200])
    if (big && !/^(?:create|make|start)\b.*\blist\b/i.test(s)) x.err(`Write numbers without commas: ${big[0].replace(/,/g, '')}, not ${big[0]}. (In Python a comma separates two values, so ${big[0]} would be ${big[0].split(',').length} numbers.)`);
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
      .replace(/(?<!\.)\.\s*$/, '')   // a sentence's full stop, after a number too: "set lives to 3." is 3
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

  /* Half a ‹blank› left behind (its words deleted, a mark kept: "set speed to 4›"): the mark is left out
     of the code, and the line says to delete it. Whole ‹blanks› are kept for the line to report; a mark
     inside text in quotes is text. -> { line, stray } (stray: the mark, or null) */
  function dropStrayMarks(l) {
    if (!/[‹›]/.test(l) || /^\s*(?:note|comment|description)\s*:/i.test(l)) return { line: l, stray: null };
    let out = '', q = null, stray = null;
    for (let k = 0; k < l.length; k++) {
      const c = l[k];
      if (c === '‹' && l.indexOf('›', k) > k) { const end = l.indexOf('›', k); out += l.slice(k, end + 1); k = end; continue; }
      if ((c === '‹' || c === '›') && !q) { stray = stray || c; continue; }
      if (!q && (c === '"' || c === "'")) q = c;
      else if (q && c === q && l[k - 1] !== '\\') q = null;
      out += c;
    }
    return { line: out, stray };
  }
  const strayMark = (c) => `A ${c} is left over from a ‹blank› whose words were deleted, so it's left out of the code: delete it here too. (Clicking in a ‹blank› selects all of it, so what you type replaces it, marks and all.)`;

  function translateSection(sec, env, project) {
    const strays = new Map();
    const lines = sec.text.split('\n').map((l, i) => { const d = dropStrayMarks(l); if (d.stray) strays.set(i, d.stray); return d.line; });
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
        // after the tool's description, so it stays the first statement (a docstring)
        let at = entry.fn.outIdx + 1;
        for (let j = at; j < out.length && (out[j].doc || /^\s*(#|$)/.test(out[j].text)); j++) if (out[j].doc) at = j + 1;
        out.splice(at, 0, { text: ' '.repeat((entry.fn.level + 1) * 4) + 'global ' + auto.join(', '), src: entry.fn.line, extra: true });
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
        if (ind > top.ind) { stack.push({ ind, type: pending.type, fn: pending.fn, cls: pending.cls, empty: true, head: pending.line, level: stack.length }); pushed = true; }
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
        if (!first && !last && !t) out.push({ text: '', src: i, doc: true });
        else out.push({ text: ' '.repeat(level * 4) + (first ? '"""' + t + (last ? '"""' : '') : t + (last ? '"""' : '')), src: i, doc: true });
        if (last && !seenCode) { seenCode = true; if (level === 0) docEnd = out.length; }   // the file's own description stays first
        continue;
      }
      if (!res.comment) seenCode = true;
      for (const p of res.pys || [res.py]) out.push({ text: ' '.repeat(level * 4) + p, src: i });
      if (res.strOpen) strOpen = { delim: res.strOpen, line: i };
      if (res.open) {
        const fn = res.fn ? { ...res.fn, outIdx: out.length - 1, level, line: i, locals: new Set(res.fn.params), globals: new Set() } : null;
        if (fn) fnRecords.push(fn);
        pending = { line: i, type: res.open, level, outIdx: out.length - 1, fn, cls: res.cls };
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
    // a module the file imports itself (import random, import os, sys, import os.path) isn't imported again
    const imported = new Set();
    for (const o of out) {
      const im = o.text.match(/^\s*import\s+([^#]+?)\s*(?:#.*)?$/);
      if (im) for (const part of im[1].split(',')) { const [name, as] = part.trim().split(/\s+as\s+/); imported.add(as || name.split('.')[0]); }
    }
    for (const mod of [...env.imports].sort()) {
      if (imported.has(mod)) continue;
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
    for (const [i, c] of strays) if (!info[i].errs.some(e => e.startsWith('Fill in the'))) info[i].warns.push(strayMark(c));

    return { lines: all, info, text: all.map(o => o.text).join('\n') + '\n' };
  }

  function compileProject(project) {
    const env = { syms: new SymTable(), seen: new Set(), pass: 1, imports: new Set(), multiDirty: true, order: project.sections.map(s => s.file) };
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
    T('Objects', 'field ‹name›: ‹type›', 'name: type', 'Inside a data class: a value every object has. The type can be whole number, decimal, text, yes/no or a Python type.', ['tools', 'main']),
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

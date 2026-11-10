/* IntuaCode — C++ language pack: sentences -> C++ (and Arduino sketches).
 *
 * Same sentences as Python where they make sense. C++ needs a type for every
 * value, so the translator works types out from the values (text -> std::string,
 * whole numbers -> int, decimals -> double, yes/no -> bool) and explains the choice.
 * Tools use `auto` for their inputs and result (C++20) unless the sentence names
 * types ("define area using decimal w, decimal h giving back decimal").
 *
 * Classes: "define class Item" with "field name: text", "when made using …",
 * tools inside, and "make a new Item with … and store in pen".
 *
 * Arduino (project.kind 'arduino'): one Sketch section. Lines at the left edge are
 * the board's settings; "when the board starts" is setup() and "over and over" is
 * loop(). Pins, waiting, tones and the serial monitor have their own sentences.
 *
 * compileCppProject(project) returns the same shape as the other packs.
 */
(function (root) {
  'use strict';

  const code = (s) => '`' + s + '`';
  const note = (inf, s) => { if (!inf.notes.includes(s)) inf.notes.push(s); };

  /* ‹Blanks› left to fill in (a hallway step, a blueprint). A blank that is text (in quotes) stays as
     it is; any other becomes _, so the rest of the line still translates. Each such line then has one
     problem: "Fill in the ‹…› slot." Notes can mention ‹blanks› freely. (As in web_write.js.) */
  function holdBlanks(text) {
    const blanks = new Map(), strays = new Map();
    const lines = String(text || '').split('\n').map((l, i) => {
      if (!/[‹›]/.test(l) || /^\s*(?:note|comment|description)\s*:/i.test(l)) return l;
      let out = '', q = null, fill = 0;
      for (let k = 0; k < l.length; k++) {
        const c = l[k];
        if (c === '‹' && l.indexOf('›', k) > k) {
          const end = l.indexOf('›', k), slot = l.slice(k, end + 1);
          blanks.set(i, [...new Set([...(blanks.get(i) || []), slot])]);
          out += q && !fill ? slot : '_';
          k = end; continue;
        }
        // half a ‹blank› left behind (its words deleted, a mark kept): left out, and the line says so
        if ((c === '‹' || c === '›') && !(q && !fill)) { if (!strays.has(i)) strays.set(i, c); continue; }
        if (!q && (c === '"' || c === "'")) q = c;
        else if (q && c === q && l[k - 1] !== '\\' && !fill) q = null;
        else if (q && (c === '{' || c === '}') && l[k + 1] === c && !fill) { out += c + c; k++; continue; }   // {{ and }} are braces themselves
        else if (q && c === '{') fill++;                                                                     // {name} in text is a value
        else if (q && c === '}' && fill) fill--;
        out += c;
      }
      return out;
    });
    return { text: lines.join('\n'), blanks, strays };
  }
  const STRAY_MARK = (c) => `A ${c} is left over from a ‹blank› whose words were deleted, so it's left out of the code: delete it here too. (Clicking in a ‹blank› selects all of it, so what you type replaces it, marks and all.)`;
  function reportBlanks(info, blanks, strays) {
    for (const [i, slots] of blanks) if (info[i]) { info[i].errs = slots.map(s => `Fill in the ${s} slot.`); info[i].warns = []; }
    for (const [i, c] of strays || []) if (info[i] && !blanks.has(i)) info[i].warns.push(STRAY_MARK(c));
  }
  const FILLER = /^(?:(?:please|now|next|then|and then|also|just|i want to|i'd like to|let's|let us|go ahead and)\s*,?\s+)+/i;
  const RAW = /^(?:c\+\+|cpp|raw)\s*:\s?(.*)$/i;
  const ABOVE = /^(?:above main|outside main|at the top)\s*:\s?(.*)$/i;

  /* Split at commas and "and", outside quotes and brackets. */
  function splitItems(s, andToo = true) {
    const parts = []; let depth = 0, quote = null, cur = '';
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (quote) { cur += c; if (c === '\\') cur += s[++i] || ''; else if (c === quote) quote = null; continue; }
      // (an apostrophe in a word, as in "the caller's", starts no quote)
      if (c === '"' || (c === "'" && !/\w/.test(s[i - 1] || ''))) { quote = c; cur += c; continue; }
      if ('([{<'.includes(c) && !(c === '<' && /\s/.test(s[i + 1] || ''))) depth++;
      if (')]}>'.includes(c) && depth > 0 && !(c === '>' && /\s/.test(s[i - 1] || ''))) depth--;
      if (depth === 0 && c === ',') { parts.push(cur); cur = ''; continue; }
      if (andToo && depth === 0 && /\s/.test(c) && /^\s+and\s+/i.test(s.slice(i))) { const m = s.slice(i).match(/^\s+and\s+/i); parts.push(cur); cur = ''; i += m[0].length - 1; continue; }
      cur += c;
    }
    parts.push(cur);
    return parts.map(p => p.trim()).filter(Boolean);
  }
  /* Like s.match(re), but sentence words inside quotes never count: they are hidden while matching
     and the groups hold the real text. */
  const withIndices = new Map();   // by source: a regex written in a function is a new object each time
  function qmatch(s, re) {
    let red = withIndices.get(re.source + '/' + re.flags);
    if (!red) { red = new RegExp(re.source, re.flags.replace(/[gd]/g, '') + 'd'); withIndices.set(re.source + '/' + re.flags, red); }
    const m = s.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, (q) => q[0] + '\u0001'.repeat(q.length - 2) + q[0]).match(red);
    if (!m) return null;
    const out = m.indices.map(p => (p ? s.slice(p[0], p[1]) : undefined));
    out.index = m.index; out.input = s;
    return out;
  }
  /* Text in double quotes: {name} fills in a value, and {{ and }} are braces themselves. */
  const FILL = /\{\{|\}\}|\{([^{}]+)\}|[{}]/g;

  /* Split at a phrase ("followed by"), outside quotes. */
  function splitPhrase(s, re) {
    const strs = [];
    const masked = s.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, (m) => { strs.push(m); return `\u0001${strs.length - 1}\u0001`; });
    return masked.split(re).map(p => p.replace(/\u0001(\d+)\u0001/g, (m, i) => strs[+i]).trim()).filter(Boolean);
  }

  const TYPE_WORDS = { number: 'int', numbers: 'int', 'whole number': 'int', 'whole numbers': 'int', decimal: 'double', decimals: 'double', text: 'std::string', words: 'std::string', 'yes/no': 'bool', 'yes/no value': 'bool', 'yes/no values': 'bool', character: 'char', characters: 'char' };
  /* What a list holds, as said after "list of": "whole numbers", "text", or a C++ type and "values" ("float values"). */
  function itemType(word, x) {
    const low = String(word || '').trim().toLowerCase();
    if (TYPE_WORDS[low]) return fixText(TYPE_WORDS[low], x);
    const v = String(word).trim().match(/^(.+?)\s+values$/i);
    const t = v && typeOf(v[1], x);
    return t && t !== 'void' && !/[&]$/.test(t) ? t : null;
  }
  const CPP_TYPES = /^(?:const\s+)?(?:unsigned\s+)?(?:int|long|long long|short|double|float|bool|char|void|size_t|auto|std::string|string|String|byte|uint8_t|uint16_t|uint32_t|int8_t|int16_t|int32_t)(?:\s*[&*])?$/;
  const TYPE_WORD_RE = /^(whole numbers?|numbers?|decimals?|text|words|yes\/no|characters?|nothing|list of (?:whole numbers|numbers|decimals|text|words))\s+/i;

  /* A type written in a sentence -> C++ type. */
  function typeOf(word, x) {
    const w = String(word || '').trim().replace(/^an?\s+(?=\S)/i, '');   // "giving back a whole number"
    const low = w.toLowerCase();
    if (low === 'nothing') return 'void';
    // "read-only list of whole numbers" is a const reference (the caller's value, not copied, can't be changed);
    // "the caller's Item" a reference (changes reach the caller's own value)
    const ref = w.match(/^(read-only|the caller's(?: own)?)\s+(.+)$/i);
    if (ref) { const t = typeOf(ref[2], x); return t && t !== 'void' && !/[&*]$/.test(t) ? (/^read/i.test(ref[1]) ? `const ${t}&` : `${t}&`) : null; }
    const list = low.match(/^list of (.+)$/);
    if (list) { x.needs.add('vector'); return `std::vector<${fixText(TYPE_WORDS[list[1]] || list[1], x)}>`; }
    if (TYPE_WORDS[low]) return fixText(TYPE_WORDS[low], x);
    if (CPP_TYPES.test(w) || x.classes.has(w) || /^(?:const\s+)?std::\w+(?:<.+>)?(?:\s*[&*])?$/.test(w) || /^(?:const\s+)?(?:vector|map|set|array|pair|unordered_map|unordered_set|deque|list)<.+>(?:\s*[&*])?$/.test(w)) return fixText(w, x);
    return null;
  }
  const fixText = (t, x) => (x.arduino ? t.replace(/std::string|\bstring\b/, 'String') : t);

  /* "whole number a" / "decimal price" / "a" -> { name, type } */
  function param(p, x) {
    const s = p.trim();
    const tw = s.match(TYPE_WORD_RE);
    if (tw) return { name: s.slice(tw[0].length).trim(), type: typeOf(tw[1], x) };
    const typed = s.match(/^(.*[\s&*])([A-Za-z_]\w*)$/);
    if (typed && typeOf(typed[1], x)) return { name: typed[2], type: typeOf(typed[1], x) };
    return { name: s, type: null };
  }

  function exprType(e, x) {
    const t = e.trim();
    const TEXT = x.arduino ? 'String' : 'std::string';
    if (/^"/.test(t) || /^text\(/.test(t) || /^std::(to_string|string)/.test(t) || /^String\(/.test(t)) return TEXT;
    if (/^'.'$/.test(t)) return 'char';
    if (/^-?\d+$/.test(t)) return 'int';
    if (/^-?\d*\.\d+$/.test(t)) return 'double';
    if (/^(true|false)$/.test(t)) return 'bool';
    if (/^std::sto(i|l)\(|\.size\(\)$|^random_number\(|^random\(|^digitalRead\(|^analogRead\(|\.toInt\(\)$/.test(t)) return 'int';
    if (/^millis\(\)$|^pulseIn\(/.test(t)) return 'unsigned long';
    if (x.arduino && /^(?:map|constrain)\([^()]*(?:\([^()]*\)[^()]*)*\)$/.test(t)) return 'int';
    if (x.arduino && /^(?:LED_BUILTIN|A\d+|HIGH|LOW)$/.test(t)) return 'int';
    if (/^std::stod\(|\.toFloat\(\)$/.test(t)) return 'double';
    if (/^[A-Za-z_]\w*$/.test(t) && x.types[t]) return x.types[t];
    const ids = t.match(/[A-Za-z_]\w*/g) || [];
    if (ids.length && /[-+*/%]/.test(t) && ids.every(i => x.types[i] === 'int' || x.types[i] === 'double')) return ids.some(i => x.types[i] === 'double') || /\d\.\d/.test(t) ? 'double' : 'int';
    const noTemplates = t.replace(/([\w:])<[\w:<>,\s*&]*>(?=\s*[({]|::)/g, '$1');   // make_unique<Circle>(…) isn't a comparison
    if (/[<>=!]=|[<>]|&&|\|\|/.test(noTemplates) && !/<</.test(noTemplates)) return 'bool';
    return 'auto';
  }

  // Brackets with brackets inside, up to 4 deep (a regular expression can't count further).
  const nest = (o, c) => { let s = `[^${o}${c}]*`; for (let i = 0; i < 3; i++) s = `(?:[^${o}${c}]|${o}${s}${c})*`; return o + s + c; };
  const PAREN = nest('\\(', '\\)'), SQUARE = nest('\\[', '\\]');
  // An operand: a protected string, a number or a name, then any .names, ::names, ->names, calls and indexes.
  const OPD = String.raw`(?:⟦\d+⟧|-?\d+(?:\.\d+)?|[A-Za-z_]\w*)(?:(?:\.|::|->)[A-Za-z_]\w*|${PAREN}|${SQUARE})*`;
  // A phrase that starts with an operand ("x as text") never starts partway through one (after a . or ->).
  const R = (p) => new RegExp(p.replace(/^\(OPD\)/, '(?<![\\w.]|::|->)(OPD)').replace(/OPD/g, OPD), 'gi');

  /* Brackets right after a phrase like "length of x" would apply to its result: x.size() (…) runs the
     number size() gives back. That is an error on the line, never C++ that is silently wrong. */
  function looseBrackets(m, q, strs, inf) {
    const after = q.slice(m.index + m[0].length), last = m[m.length - 1];
    const said = (t) => t.trim().replace(/⟦(\d+)⟧/g, (_, i) => strs[+i]);
    const err = (e) => { if (!inf.errs.includes(e)) inf.errs.push(e); };
    if (/^\s+[([]/.test(after)) {
      const br = after.trim()[0] === '(' ? '(…)' : '[…]';
      err(`The brackets after "${said(m[0])}" don't belong to anything.` + (/^[A-Za-z_]\w*$/.test(last) ? ` If they go with ${code(last)}, write them right after it, with no space: ${code(last + br)}.` : ''));
    } else if (/^[([]/.test(after)) {
      err(`The translator can't follow the brackets in "${said(m[0] + after.match(/^\S*/)[0])}": too many inside each other, or one isn't closed. Work out the inner part on the line before and store it, or write this line as c++:.`);
    }
  }

  /* After the words have become C++: shapes that would mean something other than the sentence.
     - "not x is y": !x == y applies ! to x alone, so it's !(x == y).
     - "1 is less than x is less than 10": 1 < x < 10 is always true or false, so it's 1 < x && x < 10.
     - "answer is "yes" or "y"": the name is said again; another comparison with a bare value after && or ||
       is an error.
     - Text joined with + : "Score: " + score adds to the text's address (it prints part of the text), so the
       text becomes a std::string (String on Arduino) and a known number becomes text first.
     - In a condition (cond), a single = is a comparison: if (n = 5) would store 5.
     - A list's size minus something: size() can't be negative, so on an empty list size() - 1 is a huge number.
     - 7 / 2 with two whole numbers written out is 3 in C++: said, since in words it reads 3.5. */
  function cppTwoReadings(q, x, strs, inf, cond) {
    const said = (t) => t.trim().replace(/⟦(\d+)⟧/g, (_, i) => strs[+i]);
    const T = (v) => (/^-?\d+$/.test(v) ? 'int' : /^-?\d*\.\d+$/.test(v) ? 'double' : x.types[v] || '');
    const isText = (k) => /^⟦(\d+)⟧$/.test(k) && /^"/.test(strs[+k.slice(1, -1)]);
    if (cond && /(^|[^=!<>])=(?!=)/.test(q)) { q = q.replace(/(^|[^=!<>])=(?!=)/g, '$1 == '); note(inf, 'In a condition, `=` was changed to `==`: in C++ `=` stores a value (and `if (n = 5)` would always be true).'); }
    q = q.replace(new RegExp(String.raw`!\s*(${OPD})\s+(==|!=|<=|>=|<|>)\s+(${OPD})`, 'g'), (m, a, op, b) => { note(inf, '`!` would apply to the first value alone, so the whole comparison goes in brackets: `!(…)`.'); return `!(${a} ${op} ${b})`; });
    q = q.replace(new RegExp(String.raw`(?<![\w.⟧\])])(${OPD})\s+(<=|>=|<|>)\s+(${OPD})\s+(<=|>=|<|>)\s+(${OPD})`, 'g'), (m, a, op1, b, op2, c) => {
      if (!/^[A-Za-z_]\w*$|^-?\d+(?:\.\d+)?$/.test(b)) { inf.errs.push(`"${said(m)}" is two comparisons in a row, which C++ doesn't read the way it sounds. Say it as two tests joined by "and".`); return m; }
      note(inf, `C++ reads \`${a} ${op1} ${b} ${op2} ${c}\` one comparison at a time, so it is written as two tests: \`${a} ${op1} ${b} && ${b} ${op2} ${c}\`.`);
      return `${a} ${op1} ${b} && ${b} ${op2} ${c}`;
    });
    const EITHER = new RegExp(String.raw`(?<![\w.⟧\])])(${OPD})\s+(==|!=|<=|>=|<|>)\s+(${OPD})\s+(&&|\|\|)\s+(⟦\d+⟧|-?\d+(?:\.\d+)?|true|false)(?=\s*(?:$|[)\],;]|&&|\|\|))`);
    for (let guard = 0, m; guard < 8 && (m = q.match(EITHER)); guard++) {
      const [all, lhs, op, rhs, join, lit] = m;
      if (op === '==' && join === '||' && /^[A-Za-z_][\w.]*(?:\[[^\]]*\])*$/.test(lhs)) {
        note(inf, `\`||\` joins two whole tests, so the name is said again: \`${lhs} == … || ${lhs} == …\`. (\`${lhs} == ${said(rhs)} || ${said(lit)}\` would always be true.)`);
        q = q.slice(0, m.index) + `${lhs} == ${rhs} || ${lhs} == ${lit}` + q.slice(m.index + all.length);
        continue;
      }
      inf.errs.push(`"… ${join === '&&' ? 'and' : 'or'} ${said(lit)}" could mean two things, and as C++ it would test ${code(said(lit))} on its own. Say the whole test each time, like: x is "a" or x is "b".`);
      break;
    }
    // text joined with +
    const TEXT = x.arduino ? 'String' : 'std::string';
    let joined = false;
    q = q.replace(new RegExp(String.raw`(?<![\w.⟧\])])(${OPD})(\s*\+\s*)(${OPD})(?![\w.(\[])`, 'g'), (m, a, plus, b) => {
      if (!isText(a) && !isText(b)) return m;
      joined = true;
      const side = (v) => (isText(v) ? `${TEXT}(${v})` : !x.arduino && /^(?:int|double|float|long|unsigned long|bool)$/.test(T(v)) ? `std::to_string(${v})` : v);
      return `${side(a)} + ${side(b)}`;
    });
    if (joined) note(inf, `Text written in quotes is turned into a ${code(TEXT)} before it is joined with \`+\`` + (x.arduino ? '' : ', and a number into text with `std::to_string`') + '. (In C++, `"Score: " + score` would add to the text\'s place in memory, not join them.)');
    // a list's size minus something
    q = q.replace(/([A-Za-z_][\w.]*(?:\([^()]*\))?\.size\(\))(\s*-\s*)/g, (m, sz) => { note(inf, '`size()` is never negative, so on an empty list `size() - 1` would be a huge number: `static_cast<int>` makes it a plain whole number first.'); return `static_cast<int>(${sz}) - `; });
    // whole numbers divided
    for (const m of q.matchAll(/(?<![\w.])(\d+)\s*\/\s*(\d+)(?![\w.])/g)) {
      if (+m[1] % +m[2]) { const w = `In C++, a whole number divided by a whole number is a whole number: ${m[1]} / ${m[2]} is ${Math.trunc(+m[1] / +m[2])}, not ${+m[1] / +m[2]}. For ${+m[1] / +m[2]}, write one as a decimal: ${m[1]}.0 divided by ${m[2]}.`; if (!inf.warns.includes(w)) inf.warns.push(w); }
    }
    return q;
  }

  /* Is p one call of fn, brackets and all ("String(t)", not "String(a) + b")? */
  function wholeCall(p, fn) {
    if (!p.startsWith(fn + '(')) return false;
    let depth = 0, q = null;
    for (let i = fn.length; i < p.length; i++) {
      const c = p[i];
      if (q) { if (c === '\\') i++; else if (c === q) q = null; continue; }
      if (c === '"' || c === "'") q = c;
      else if (c === '(') depth++;
      else if (c === ')' && --depth === 0) return i === p.length - 1;
    }
    return false;
  }
  // tools every board or program has without being defined in the sentences
  const BUILT_IN = /^(?:abs|min|max|sqrt|pow|sq|sin|cos|tan|floor|ceil|round|random|randomSeed|millis|micros|analogRead|digitalRead|pulseIn|map|constrain|bitRead|bitSet|bitClear|bitWrite|highByte|lowByte|printf|rand|srand)$/;
  /* A tool that isn't defined here: an error, unless the program includes files (the tool can come from one). */
  function unknownTool(name, x, inf) {
    if (/[.:>]/.test(name) || x.fns.has(name) || x.known.has(name) || x.classes.has(name) || BUILT_IN.test(name)) return;
    if (x.headers) { const w = `${code(name)} isn't defined here, so it must come from an included file.`; if (!inf.warns.includes(w)) inf.warns.push(w); }
    else inf.errs.push(`There's no tool called ${code(name)}. Make one with "define ${name} using …".`);
  }

  function cppExpr(src, x, inf, cond = false) {
    let s = String(src || '').trim();
    if (!s) { inf.errs.push('Something is missing here: a value.'); return '0'; }
    // "the result of area with 2, 3": what a tool gives back. It is the whole value, since "with …" runs to the end.
    const res = qmatch(s, /^(?:the\s+)?result of\s+(self\.[A-Za-z_]\w*|[A-Za-z_]\w*(?:(?:\.|->|::)[A-Za-z_]\w*)*)(?:\s+with\s+(.+))?$/i);
    if (res) {
      const name = res[1].replace(/^self\./, 'this->');
      unknownTool(res[1], x, inf);
      return `${name}(${res[2] ? splitItems(res[2]).map(a => cppExpr(a, x, inf)).join(', ') : ''})`;
    }
    const strs = [];
    // a .name or […] typed right after the text stays attached to it: "abc".size()
    let q = s.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)'/g, (m, off, all) => { strs.push(m); return ` ⟦${strs.length - 1}⟧` + (/^(?:\.[A-Za-z_]|\[)/.test(all.slice(off + m.length)) ? '' : ' '); });
    if (/'/.test(q.replace(/\b\w'\w/g, ''))) inf.warns.push("In C++, text goes in double quotes (\"like this\"). Single quotes are for one character.");
    // Swaps a phrase. One that ends in an operand, like "length of x", first checks what follows it (see looseBrackets).
    const swap = (p, to) => { const re = R(p); if (p.endsWith('(OPD)')) for (const m of q.matchAll(re)) looseBrackets(m, q, strs, inf); q = q.replace(re, to); };
    // "the result of a.rows" inside a value: a tool's result with no inputs (with inputs, only as the whole value)
    q = q.replace(/\b(?:the\s+)?result of\s+(self\.[A-Za-z_]\w*|[A-Za-z_]\w*(?:(?:\.|->|::)[A-Za-z_]\w*)*)(\s+with\b)?/gi, (m, name, w) => {
      if (w) { const e = '"the result of … with …" only works as the whole value. Store the result in a name first, then use the name.'; if (!inf.errs.includes(e)) inf.errs.push(e); return m; }
      unknownTool(name, x, inf);
      return `${name.replace(/^self\./, 'this->')}()`;
    });
    q = q.replace(/\bself\s*\.\s*/g, 'this->');
    q = q.replace(/\bthe\b/gi, ' ');
    if (x.arduino) {
      q = q.replace(/\bbuilt-?in (?:light|led)\b/gi, 'LED_BUILTIN');
      swap(String.raw`\bpin (OPD) is (on|off|high|low)\b`, (m, p, v) => { note(inf, '`digitalRead` checks whether a pin is on (HIGH) or off (LOW).'); return `digitalRead(${p}) == ${/on|high/i.test(v) ? 'HIGH' : 'LOW'}`; });
      swap(String.raw`\b(?:analog )?(?:reading|level) (?:of|on) pin (OPD)`, (m, p) => { note(inf, '`analogRead` measures the voltage on a pin as a number from 0 to 1023.'); return `analogRead(${p})`; });
      // "how long pin echo stays on": pulseIn waits for the pin to turn on, then times how long it stays on (in microseconds)
      swap(String.raw`\bhow long pin (OPD) stays (on|off|high|low)\b`, (m, p, v) => { note(inf, '`pulseIn` waits for the pin to change, then measures how long it stays that way, in microseconds (millionths of a second).'); return `pulseIn(${p}, ${/on|high/i.test(v) ? 'HIGH' : 'LOW'})`; });
      swap(String.raw`\bpin (OPD)`, '$1');
      q = q.replace(/\b(?:time|milliseconds) since (?:the )?start\b/gi, () => { note(inf, '`millis()` is how many milliseconds have passed since the board started.'); return 'millis()'; });
      // "at least 500 milliseconds have passed since lastBlink": millis() - lastBlink >= 500 (the way to wait without stopping)
      swap(String.raw`\b(at least|more than|less than|at most) (OPD) milliseconds? (?:have|has) passed since (OPD)`, (m, how, n, since, off, all) => {
        note(inf, '`millis()` is the time since the board started, so `millis() - ' + since + '` is how long ago ' + since + ' was. Taking away (rather than adding to ' + since + ') keeps working when millis() wraps round to 0 after 49 days.');
        const test = `millis() - ${since} ${{ 'at least': '>=', 'more than': '>', 'less than': '<', 'at most': '<=' }[how.toLowerCase()]} ${n}`;
        return /\bnot\s*$/i.test(all.slice(0, off)) ? `(${test})` : test;   // "not at least …" tests the whole of it
      });
      // "reading scaled from 0–1023 to 0–255": map moves a value from one range to another
      swap(String.raw`(OPD) scaled from (OPD)\s*[–—]\s*(OPD) to (OPD)\s*[–—]\s*(OPD)`, (m, v, a, b, c, d) => { note(inf, '`map` moves a value from one range to another, in whole numbers. It doesn\'t stop at the ends: "limited to" does that.'); return `map(${v}, ${a}, ${b}, ${c}, ${d})`; });
    }
    // "level limited to 0–255": constrain (Arduino) or std::clamp (C++) keeps it from going past either end
    swap(String.raw`(OPD) limited to (OPD)\s*[–—]\s*(OPD)`, (m, v, a, b) => {
      if (!x.arduino) x.needs.add('algorithm');
      note(inf, `${x.arduino ? '`constrain`' : '`std::clamp`'} keeps a value from going below the first number or above the second.`);
      return `${x.arduino ? 'constrain' : 'std::clamp'}(${v}, ${a}, ${b})`;
    });
    swap(String.raw`\bfirst item (?:of|in) (OPD)`, x.arduino ? '$1[0]' : '$1.front()');
    swap(String.raw`\blast item (?:of|in) (OPD)`, x.arduino ? '$1[(sizeof($1) / sizeof($1[0])) - 1]' : '$1.back()');
    swap(String.raw`\bitem (OPD) (?:of|in) (OPD)`, '$2[$1]');
    swap(String.raw`\b(?:length|size) of (OPD)`, (m, a) => {
      if (!x.arduino) return `${a}.size()`;
      if (/^String$/.test(x.types[a] || '')) return `${a}.length()`;
      note(inf, 'Arduino lists are plain arrays: `sizeof(list) / sizeof(list[0])` works out how many items they hold.');
      return `(sizeof(${a}) / sizeof(${a}[0]))`;
    });
    // "random number from 1 to n plus 1": a number up to n, then plus 1, or up to n plus 1?
    for (const m of q.matchAll(R(String.raw`\brandom (?:whole )?number (?:from|between) (OPD) (?:to|and) (OPD)`))) {
      const after = q.slice(m.index + m[0].length).match(/^\s+(plus|minus|times|divided by|mod)\b/i);
      if (after) inf.errs.push(`"${m[0].trim()} ${after[1]} …" could mean two things. Put brackets round the end you mean, like random number from 1 to (n plus 1).`);
    }
    // words that follow their value ("as text"): right after a sum they could mean the last value or the whole sum
    for (const p of [String.raw`(OPD) as (?:a )?(?:whole )?number\b`, String.raw`(OPD) as (?:a )?decimal\b`, String.raw`(OPD) as text\b`]) {   // (squared binds tightest, as in maths)
      for (const m of q.matchAll(R(p))) {
        if (!/(?:\b(?:plus|minus|times|divided by|mod)|[-+*/%])\s*$/i.test(q.slice(0, m.index))) continue;
        const e = `"${m[0].slice(m[1].length).trim()}" comes right after a calculation, so it could go with just ${code(m[1])} or with all of it. Put brackets round the part you mean, like (price times qty) ${m[0].slice(m[1].length).trim()}.`;
        if (!inf.errs.includes(e)) inf.errs.push(e);
      }
    }
    swap(String.raw`\brandom (?:whole )?number (?:from|between) (OPD) (?:to|and) (OPD)`, (m, a, b) => {
      if (x.arduino) { note(inf, '`random(low, high)` on Arduino never reaches `high`, so 1 is added to include the top number.'); return `random(${a}, ${/^\d+$/.test(b) ? +b + 1 : b + ' + 1'})`; }
      x.needs.add('random'); note(inf, 'C++ has no one-word random function, so a small helper, `random_number`, is added at the top. It uses `<random>` and includes both ends.'); return `random_number(${a}, ${b})`;
    });
    // "as a whole number": text is read as one (stoi); a number is cut to its whole part (a cast)
    const numeric = (a) => /^-?\d+(?:\.\d+)?$/.test(a) || /^(?:(?:unsigned|signed|long|short|const)\s+)*(?:int|long|short|double|float|size_t|unsigned|byte|u?int\d+_t)$/.test((x.types[a] || '').trim());
    swap(String.raw`(OPD) as (?:a )?(?:whole )?number\b`, (m, a) => {
      if (numeric(a)) { note(inf, `\`static_cast<int>\` keeps the whole part of ${code(a)} (2.7 becomes 2).`); return `static_cast<int>(${a})`; }
      if (x.arduino) return `${a}.toInt()`;
      note(inf, '`std::stoi` turns text into a whole number (it stops with an error if the text isn\'t a number).'); return `std::stoi(${a})`;
    });
    swap(String.raw`(OPD) as (?:a )?decimal\b`, (m, a) => (numeric(a) ? `static_cast<double>(${a})` : x.arduino ? `${a}.toFloat()` : `std::stod(${a})`));
    swap(String.raw`(OPD) as text\b`, x.arduino ? 'String($1)' : 'std::to_string($1)');
    swap(String.raw`(OPD) squared\b`, '($1 * $1)');
    // "is even" / "is odd": the remainder after dividing by 2. A sum before it is checked as a whole: "n plus 1 is even" is (n + 1) % 2 == 0.
    const GROUP = String.raw`\((?:[^()]|\([^()]*\))*\)`, PART = `(?:${GROUP}|OPD)`, MATHS = String.raw`\s+(?:plus|minus|times|divided by|mod)\s+`;
    q = q.replace(R(String.raw`(?<![\w.:>])(not\s+)?(${PART}(?:${MATHS}${PART})*)\s+(is not|isn't|is)\s+(even|odd)\b`), (m, notFirst, a, is, which) => {
      const even = /even/i.test(which) !== Boolean(notFirst) !== /n[o']t/i.test(is);   // each "not" turns it round
      const sum = new RegExp(MATHS, 'i').test(a.replace(new RegExp(GROUP, 'g'), '()'));
      note(inf, '`% 2` is the remainder after dividing by 2: 0 for even numbers. For odd numbers it is 1, or -1 when the number is negative, so odd is tested with `!= 0`.');
      return `${sum ? `(${a})` : a} % 2 ${even ? '==' : '!='} 0`;
    });
    const W = [
      [/\bis not (?:equal to|the same as)\b|\bisn't\b|\bis not\b/gi, ' != '], [/\bis at least\b|\bis (?:greater|more) than or equal to\b/gi, ' >= '], [/\bis at most\b|\bis (?:less|smaller) than or equal to\b/gi, ' <= '],
      [/\bis (?:greater|more|bigger|higher) than\b/gi, ' > '], [/\bis (?:less|smaller|lower|fewer) than\b/gi, ' < '], [/\bis (?:equal to|the same as)\b|\bequals\b|\bis\b/gi, ' == '],
      [/\bplus\b/gi, ' + '], [/\bminus\b/gi, ' - '], [/\btimes\b/gi, ' * '], [/\bdivided by\b/gi, ' / '], [/\bmod\b/gi, ' % '],
      [/\band\b/gi, ' && '], [/\bor\b/gi, ' || '], [/\bnot\b/gi, ' !'], [/\b(?:yes|true)\b/gi, 'true'], [/\b(?:no|false)\b/gi, 'false'],
    ];
    for (const [re, to] of W) q = q.replace(re, to);
    q = cppTwoReadings(q, x, strs, inf, cond);
    q = q.replace(/(?<![\w.:>⟦])([A-Za-z_]\w*)\b(?!\s*::)/g, (m, id, off) => {
      if (/^(true|false|std|random_number|random|text|auto|int|double|float|long|short|unsigned|signed|size_t|uint8_t|uint16_t|uint32_t|int8_t|int16_t|int32_t|byte|bool|char|const|return|nullptr|this|sizeof|String|HIGH|LOW|INPUT|OUTPUT|INPUT_PULLUP|LED_BUILTIN|A\d+|millis|micros|digitalRead|analogRead|Serial|new|delete|static_cast|reinterpret_cast|const_cast)$/.test(id) || x.types[id] || x.fns.has(id) || x.classes.has(id) || x.known.has(id)) return id;
      if (/^\d/.test(id) || /^\s*\(/.test(q.slice(off + m.length))) return id;
      inf.warns.push(`${code(id)} hasn't been set anywhere yet.`);
      return id;
    });
    q = q.replace(/\s+/g, ' ').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')').replace(/\s+,/g, ',').replace(/!\s+/g, '!').replace(/\s*->\s*/g, '->').trim();
    q = q.replace(/⟦(\d+)⟧/g, (m, i) => {
      const str = strs[+i];
      if (str[0] !== '"' || !/[{}]/.test(str)) return str;
      const toks = [...str.slice(1, -1).matchAll(new RegExp(FILL.source + '|[^{}]+', 'g'))];
      const plain = (t) => (t[1] != null ? null : /^[{}]/.test(t[0]) ? t[0][0] : t[0]);   // {{ and }} are braces themselves
      if (!toks.some(t => t[1] != null)) return '"' + toks.map(plain).join('') + '"';
      const parts = [];
      let text = '';
      for (const t of toks) {
        if (t[1] == null) { text += plain(t); continue; }
        if (text) parts.push('"' + text + '"');
        text = '';
        parts.push(cppExpr(t[1], x, inf));
      }
      if (text) parts.push('"' + text + '"');
      if (x.arduino) {
        // "Temp: {t as text}": text, then a value already made into text, joins as it is ("Temp: " + String(t))
        const wrap = !(parts.length > 1 && /^"/.test(parts[0]) && wholeCall(parts[1], 'String'));
        note(inf, 'Text with {…} inside is joined with `+`.' + (wrap ? ' Starting with `String(…)` makes the joining work on Arduino.' : '') + ' (A brace itself is written twice: {{ or }}.)');
        return parts.map((p, k) => (k === 0 && wrap ? `String(${p})` : p)).join(' + ');
      }
      x.needs.add('text');
      note(inf, 'Text with {…} inside is built by a small helper, `text(…)`, added at the top: it joins the pieces and the values into one std::string. (A brace itself is written twice: {{ or }}.)');
      return `text(${parts.join(', ')})`;
    });
    return q;
  }

  /* A piece written after std::cout << goes in brackets when it holds an operator that binds no tighter
     than <<, outside brackets and quotes: std::cout << n >= 1 is (std::cout << n) >= 1 and doesn't build.
     Those are the comparisons, & ^ |, && ||, ?:, = and +=, a shift (it would print two things) and a
     comma. Names, calls, a + b and text(…) stay as they are. Serial.print(…) is a call, so needs none. */
  function afterShift(p) {
    let s = p.replace(/"(?:[^"\\]|\\.)*"/g, '""').replace(/'(?:[^'\\]|\\.)+'/g, "''").replace(/(?<!-)->/g, '.');
    // the < > of static_cast<int> or std::vector<std::string> aren't comparisons (inner ones first)
    for (let t; (t = s.replace(/\b(?:(?:static|dynamic|reinterpret|const)_cast|std(?:::\w+)+)\s*<[\w:\s*&,]*>/g, 'T')) !== s;) s = t;
    let depth = 0, prev = '';
    for (const c of s) {
      if ('([{'.includes(c)) depth++;
      else if (')]}'.includes(c)) depth--;
      // & after a value is "and" for bits; at the start (&x) it is the address of x
      else if (!depth && (/[<>=^|?,]/.test(c) || (c === '&' && /[\w)\]}"']/.test(prev)))) return `(${p})`;
      if (c.trim()) prev = c;
    }
    return p;
  }

  /* The small helpers the translator adds above main when the sentences need them. (The converter knows them
     too: a program that has them, as the translator writes them, gets them from the sentences again.) */
  const HELPERS = {
    random: ['int random_number(int low, int high) {', '    static std::mt19937 generator(std::random_device{}());', '    return std::uniform_int_distribution<int>(low, high)(generator);', '}'],
    text: ['template <typename... Parts>', 'std::string text(const Parts&... parts) {', '    std::ostringstream out;', '    (out << ... << parts);', '    return out.str();', '}'],
  };

  /* Does the block under line i give back a value? (Arduino tools need a result type.) */
  function blockGivesBack(lines, i) {
    const base = lines[i].match(/^ */)[0].length;
    for (let j = i + 1; j < lines.length; j++) {
      if (!lines[j].trim()) continue;
      if (lines[j].match(/^ */)[0].length <= base) break;
      if (/^\s*(?:give back|return)\s+\S/i.test(lines[j])) return true;
    }
    return false;
  }

  function compileCpp(sec, x) {
    const lines = sec.text.split('\n');
    const info = lines.map((_, i) => ({ line: i, py: [], notes: [], warns: [], errs: [] }));
    const A = x.arduino;
    const topOut = [], mainOut = [], includes = [];
    const home = A ? topOut : mainOut;
    let out = home;
    let usingStd = null, hasSetup = false, hasLoop = false, serialStarted = false;
    const stack = []; // {ind, close, kind, buf, depth, src, cls}
    const E = (t, inf) => cppExpr(t, x, inf);
    const EC = (t, inf) => cppExpr(t, x, inf, true);   // a condition (= means ==)
    // first pass: names of tools and classes, and names that are given a decimal somewhere (so they are
    // decimals from the start: an int would quietly drop the .5 of "increase total by 0.5")
    x.decimal = x.decimal || new Set();
    for (const l of lines) {
      const s = l.trim();
      let m;
      if ((m = s.match(/^(?:set|let|make|increase|decrease|multiply|divide)\s+([A-Za-z_]\w*)\s+(?:to|be|by)\s+(.+)$/i)) && /\d\.\d|\bdivided by\b|\bas (?:a )?decimal\b|\bsquare root\b/i.test(m[2].replace(/"(?:[^"\\]|\\.)*"/g, '""'))) x.decimal.add(m[1]);
      if ((m = s.match(/^define\s+(?:an?\s+)?(?:class|structure|struct)\s+([A-Za-z_]\w*)/i))) x.classes.add(m[1]);
      else if ((m = s.match(/^define\s+([A-Za-z_]\w*)/i))) x.fns.add(m[1]);
      if ((m = s.match(/^let\s+([A-Za-z_]\w*)\s+stand for\s/i))) x.known.add(m[1]);
      if (/^start (?:the serial monitor|talking to the computer)|Serial\.begin/i.test(s)) serialStarted = true;
      // a file included beyond the ones the translator adds itself: tools can come from it
      if ((m = s.match(/^(?:(?:include|use the library)\s+|(?:c\+\+|cpp|raw|above main|outside main|at the top)\s*:\s*#\s*include\s*)(<[^>]+>|"[^"]+"|[\w./]+)/i)) && (A || !/^<?(?:iostream|string|vector|random|sstream|cstdlib|algorithm|cstdio)>?$/.test(m[1]))) x.headers = true;
      if ((m = s.match(/^(?:c\+\+|cpp|raw|above main|outside main|at the top)\s*:(.*)$/i))) {   // names made in raw C++
        for (const d of m[1].matchAll(/\b(?:class|struct)\s+([A-Za-z_]\w*)/g)) { x.classes.add(d[1]); x.known.add(d[1]); }
        for (const d of m[1].matchAll(/^\s*(?:(?:const|static|unsigned|constexpr|inline)\s+)*[A-Za-z_][\w:<>,]*[\s&*]+([A-Za-z_]\w*)\s*(?:=|;|\(|\[|\{)/g)) x.known.add(d[1]);
      }
    }
    const scopes = [new Set()];
    const isDeclared = (n) => scopes.some(sc => sc.has(n));
    /* What a line of exact C++ makes, so the sentences after it know it: "int n = 3;" (n holds whole
       numbers), "std::string name;", or "int twice(int x) {" (a tool). */
    const learnRaw = (line) => {
      // the counter a loop makes: for (int i = 0; …) or for (const auto& x : xs)
      const f = String(line).match(/\bfor\s*\(\s*(?:const\s+)?([A-Za-z_][\w:]*(?:\s*<[^;()]*>)?\s*[*&]*)\s*\b([A-Za-z_]\w*)\s*[=:]/);
      if (f) { scopes[scopes.length - 1].add(f[2]); x.types[f[2]] = f[1].trim(); }
      const d = String(line).match(/^\s*((?:(?:const|static|constexpr|inline|unsigned|signed|long|short|volatile)\s+)*[A-Za-z_][\w:]*(?:\s*<[^;={}()]*>)?(?:\s+(?:long|int|double|char))*\s*[*&]*)\s*\b([A-Za-z_]\w*)\s*(=|\{|\(|;|\[)/);
      if (!d || /^(?:return|delete|throw|using|goto|case|else|new|typedef|namespace|class|struct|enum|template|public|private|protected|sizeof|if|while|for|switch|do)$/.test(d[1].trim().split(/\s+/)[0])) return;
      const name = d[2], type = d[1].replace(/^(?:static|inline|constexpr)\s+/, '').trim();
      if (!type || type === name) return;
      if (d[3] === '(' && /\(\s*(?:\)|(?:const\s+)?[A-Za-z_][\w:<>]*[\s*&]+[A-Za-z_]\w*)/.test(line.slice(line.indexOf(name)))) { x.fns.add(name); x.known.add(name); return; }
      scopes[scopes.length - 1].add(name); x.types[name] = type;
    };
    const declare = (name, type, inf, value) => {
      if (isDeclared(name)) return `${name} = ${value};`;
      if (type === 'int' && x.decimal.has(name)) { type = 'double'; note(inf, `${code(name)} is given a decimal further on, so it is a decimal (\`double\`) from the start: a whole number (\`int\`) would drop what comes after the point.`); }
      scopes[scopes.length - 1].add(name);
      x.types[name] = type;
      const T = fixText(type, x);
      if (T !== 'auto') note(inf, `C++ needs to know what kind of value ${code(name)} holds: ${code(T)}${{ int: ' (a whole number)', double: ' (a decimal number)', 'std::string': ' (text)', String: ' (text)', bool: ' (yes or no)', 'unsigned long': ' (a big whole number that is never negative)' }[T] || ''}. It can't change kind later.`);
      else note(inf, '`auto` lets C++ work out the kind of value from what is stored.');
      return `${T} ${name} = ${value};`;
    };
    /* The end of "read pin A0 and call it level (a whole number)", "scale … and store it in level": "call it" makes
       the name (its type in brackets, or dflt); "store it in" / "keep it as" changes the name, or makes it if it's new. */
    const keep = (name, how, typeWords, inf, value, dflt = 'int') => {
      const t = typeWords ? typeOf(typeWords, x) : null;
      if (typeWords && (!t || t === 'void')) { inf.errs.push(`I don't know the type "${typeWords}". Use whole number, decimal, long, unsigned long, float, or another C++ type.`); return `auto ${name} = ${value};`; }
      if (/call it/i.test(how)) {
        if (scopes[scopes.length - 1].has(name)) inf.errs.push(`${code(name)} is already made here. To change it, say "… and store it in ${name}".`);
        const T = fixText(t || dflt, x);
        scopes[scopes.length - 1].add(name); x.types[name] = T;
        note(inf, `This makes ${code(name)}, holding ${code(T)} values${t ? ', as the sentence says' : ''}.`);
        return `${T} ${name} = ${value};`;
      }
      if (isDeclared(name)) { if (t) inf.warns.push(`${code(name)} was made before, so its type stays as it was: the type in brackets is only for "call it".`); return `${name} = ${value};`; }
      return declare(name, t || dflt, inf, value);
    };
    const cur = () => stack[stack.length - 1];
    const inside = (kind) => stack.some(b => b.kind === kind);
    const closeBlock = () => {
      const b = stack.pop();
      const declared = scopes.pop();
      while (b.buf.length && b.buf[b.buf.length - 1].text === '') b.buf.pop();
      if (b.kind === 'case') {
        // each case ends with break (C++ would otherwise carry on into the next case), unless it already
        // leaves (give back, skip to next…) or the sentences say to carry on
        const last = b.buf[b.buf.length - 1];
        const leaves = last !== b.head && /^\s*(?:return\b|break;|continue;|std::exit\(|throw\b|goto\b)/.test(last.text);
        if (!b.fall && !leaves) b.buf.push({ text: '    '.repeat(b.depth + 1) + 'break;', src: b.src });
        b.end = b.buf[b.buf.length - 1];
        b.declares = declared.size > 0;
        b.sw.cases.push(b);
      } else if (b.kind === 'switch') {
        // a case that makes a new name needs braces round it, or the cases after it would jump past the name
        b.cases.slice(0, -1).filter(c => c.declares).forEach(c => {
          c.head.text += ' {';
          b.buf.splice(b.buf.indexOf(c.end) + 1, 0, { text: '    '.repeat(c.depth) + '}', src: c.src });
          note(info[c.src], 'This case makes a new name, so its steps go in braces: without them, C++ would refuse the cases after it (they would jump past the name being made).');
        });
        if (!b.cases.length) info[b.src].errs.push('"depending on" needs its cases under it: "when it is 1", "when it is 2", "otherwise".');
        b.buf.push({ text: '    '.repeat(b.depth) + b.close, src: b.src });
      } else b.buf.push({ text: '    '.repeat(b.depth) + b.close, src: b.src });
      if (!stack.length) out = home;
    };
    lines.forEach((raw, i) => {
      const inf = info[i];
      if (!raw.trim()) { out.push({ text: '', src: i }); return; }
      const ind = raw.match(/^ */)[0].length;
      while (stack.length && ind <= cur().ind) {
        if (/^\s*(otherwise|else)\b/i.test(raw) && ind === cur().ind && cur().kind === 'if') break;
        closeBlock();
      }
      const depth = stack.length + (out === mainOut ? 1 : 0);
      const depthNow = () => stack.length + (out === mainOut ? 1 : 0);
      const say = (t) => out.push({ text: '    '.repeat(depthNow()) + t, src: i });
      const open = (head, kind, extra = {}) => { const d = depthNow(); say(head + ' {'); stack.push({ ind, close: '}', kind, src: i, buf: out, depth: d, head: out[out.length - 1], ...extra }); scopes.push(new Set()); };
      const trimmed = raw.trim();
      let m;
      // raw code is copied exactly, before any tidying of the sentence
      if ((m = trimmed.match(ABOVE))) {
        if (stack.length) inf.errs.push('"above main:" lines go at the left edge.');
        note(inf, 'C++ copied exactly as written, placed above `main` (outside every tool).');
        topOut.push({ text: m[1], src: i });
        learnRaw(m[1]);
        return;
      }
      if ((m = trimmed.match(RAW))) {
        note(inf, 'Raw C++: copied exactly as written.');
        learnRaw(m[1]);
        if (cur() && cur().kind === 'class') cur().members++;
        if (stack.length) return say(m[1]);
        // outside every sentence block: its own indentation is kept (code written as code, as Unity mode does),
        // and a sketch that writes its own setup() or loop() isn't given an empty one
        if (A && /^void\s+setup\s*\(\s*\)/.test(m[1])) hasSetup = true;
        if (A && /^void\s+loop\s*\(\s*\)/.test(m[1])) hasLoop = true;
        return out.push({ text: '    '.repeat(depthNow()) + raw.match(/^[ \t]*/)[0].replace(/\t/g, '    ') + m[1], src: i });
      }
      let s = trimmed.replace(/[.:]$/, '');
      const lead = s.match(FILLER);
      if (lead && lead[0].length < s.length) { note(inf, `Left out filler: "${lead[0].trim()}".`); s = s.slice(lead[0].length); }
      if ((m = trimmed.match(/^(?:note|comment)\s*:\s?(.*)$/i))) {
        // at the left edge, a note stays with what follows it: above main for a tool, class or include
        if (!stack.length && !A) {
          const next = lines.slice(i + 1).find(l => l.trim() && !/^\s*(?:note|comment)\s*:/i.test(l));
          if (next && /^(?:define|above main\s*:|include|use the library|let\s+\w+\s+stand for)\b/i.test(next)) { topOut.push({ text: '// ' + m[1], src: i }); return; }
        }
        return say('// ' + m[1]);
      }
      // a description: what a tool is for, as a /** … */ comment just above its function (as Doxygen reads it)
      if ((m = trimmed.match(/^description\s*:\s?(.*)$/i))) {
        const b = cur();
        if (b && b.kind === 'fn' && b.head && b.buf[b.buf.length - 1] === b.head) {
          const p = b.head.text.match(/^ */)[0];
          if (!b.doc) { b.buf.splice(b.buf.indexOf(b.head), 0, { text: p + '/**', src: i }, { text: p + ' */', src: i }); b.doc = true; }
          b.buf.splice(b.buf.indexOf(b.head) - 1, 0, { text: (p + ' * ' + m[1]).replace(/\s+$/, ''), src: i });
          note(inf, 'A description: a comment starting with `/**` just above the function. It says what the tool is for, and editors show it wherever the tool is used.');
          return;
        }
        note(inf, 'A description: a comment starting with `/**`. Right under "define …", it describes that tool.');
        return say(`/** ${m[1]} */`);
      }
      const M = (re) => qmatch(s, re);   // like s.match, but sentence words inside quotes never count
      // --- program setup
      if ((m = M(/^(?:include|use the library)\s+(<[^>]+>|"[^"]+"|[\w./]+)$/i))) {
        const h = /^[<"]/.test(m[1]) ? m[1] : `<${m[1]}>`;
        note(inf, `${code('#include ' + h)} brings in a library${/^"/.test(h) ? ' (a file of this project)' : ''}, so the program can use what it defines.`);
        if (!includes.some(e => e.h === h)) includes.push({ h, src: i });
        return;
      }
      // "let LED stand for 13": #define, a name the compiler swaps for its text before anything else
      if ((m = M(/^let\s+([A-Za-z_]\w*)\s+stand for\s+(-?\d+(?:\.\d+)?|[A-Za-z_]\w*|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)')$/i))) {
        if (stack.length) inf.errs.push('"let … stand for …" goes at the left edge.');
        x.known.add(m[1]);
        note(inf, `\`#define\` makes ${code(m[1])} stand for ${code(m[2])}: before compiling, every ${m[1]} in the code is swapped for it. (A constant, "constant ${m[1]} is ${m[2]}", does the same job and has a type.)`);
        topOut.push({ text: `#define ${m[1]} ${m[2]}`, src: i });
        return;
      }
      if (/^use (?:namespace std|the standard names(?: directly)?|std names directly)$/i.test(s)) { usingStd = i; note(inf, '`using namespace std;` lets the code write `cout` instead of `std::cout`. Fine in small programs; big ones avoid it so names don\'t clash.'); return; }
      // --- classes
      if ((m = M(/^define\s+(?:an?\s+)?(class|structure|struct)\s+([A-Za-z_]\w*)(?:\s+based on\s+([A-Za-z_][\w:]*))?$/i))) {
        const struct = !/^class$/i.test(m[1]), [, , name, base] = m;
        if (stack.length) inf.errs.push(`${struct ? 'Structures' : 'Classes'} must be defined at the left edge, not inside another block.`);
        out = topOut;
        x.classes.add(name); x.known.add(name);
        if (struct) note(inf, `A structure (\`struct\`) bundles named values into one kind of thing: each ${code(name)} has its own fields. Everything in it can be used from anywhere (it is public), unless the sentences say otherwise.`);
        else note(inf, `A class is a blueprint for objects. Each object made from ${code(name)} keeps its own values (its fields) and can use the tools defined inside it.` + (base ? ` It builds on ${code(base)} (\`public\` inheritance: everything public in ${base} stays public).` : '') + ' Classes are placed above `main`.');
        topOut.push({ text: `${struct ? 'struct' : 'class'} ${name}${base ? ' : public ' + base : ''} {`, src: i });
        const autoPublic = struct ? null : { text: 'public:', src: i };
        if (autoPublic) topOut.push(autoPublic);
        stack.push({ ind, close: '};', kind: 'class', src: i, buf: topOut, depth: 0, cls: name, autoPublic, members: 0 });
        scopes.push(new Set());
        return;
      }
      if (cur() && cur().kind === 'class') {
        if ((m = M(/^field\s+([A-Za-z_]\w*)\s*:\s*(.+?)(?:\s+(?:=|starting (?:at|as))\s+(.+))?$/i)) || (m = M(/^has\s+(?:an?\s+)?(.+?)\s+([A-Za-z_]\w*)(?:\s+(?:starting (?:at|as)|=)\s+(.+))?$/i))) {
          const [name, typeWord, init] = /^field/i.test(s) ? [m[1], m[2], m[3]] : [m[2], m[1], m[3]];
          const t = typeOf(typeWord, x);
          if (!t) { inf.errs.push(`I don't know the type "${typeWord}". Use whole number, decimal, text, yes/no, list of …, or a C++ type.`); return; }
          x.types[name] = t; x.known.add(name);
          scopes[scopes.length - 1].add(name);   // so "set name to …" in the class's own tools changes the field
          cur().members++;
          note(inf, `Every ${cur().cls} object has its own ${code(name)} (${code(t)}).` + (init ? ` It starts as ${code(init.trim())}.` : ''));
          return say(`${t} ${name}${init ? ' = ' + E(init, inf) : ''};`);
        }
        if (/^(?:the rest is|from here on,?) (private|public)$/i.test(s) || /^(private|public) parts?$/i.test(s)) {
          const which = (s.match(/private|public/i) || ['public'])[0].toLowerCase();
          note(inf, which === 'private' ? '`private:` members can only be used by the class\'s own tools. It protects values from being changed by accident.' : '`public:` members can be used from anywhere.');
          // said before anything else in the class: it replaces the public: every class starts with
          if (cur().autoPublic && !cur().members) { cur().autoPublic.text = which + ':'; cur().autoPublic.src = i; cur().autoPublic = null; return; }
          cur().autoPublic = null;
          return out.push({ text: '    '.repeat(depth - 1) + which + ':', src: i });
        }
        cur().members++;
        if ((m = M(/^when (?:made|created|built)(?:\s+(?:using|with)\s+(.+))?$/i))) {
          const ps = m[1] ? splitItems(m[1]).map(p => param(p, x)) : [];
          ps.forEach(p => { x.types[p.name] = p.type || 'auto'; });
          if (ps.some(p => !p.type)) inf.errs.push('Say what kind each input is, like "when made using text name, whole number count".');
          note(inf, `A constructor: it runs when a new ${cur().cls} is made, and sets up its fields. Inside, "self.name" is this object's own ${code('name')} (\`this->name\`).`);
          open(`${cur().cls}(${ps.map(p => `${p.type || 'auto'} ${p.name}`).join(', ')})`, 'fn');
          ps.forEach(p => scopes[scopes.length - 1].add(p.name));
          return;
        }
      }
      // --- tools
      if ((m = M(/^define\s+([A-Za-z_]\w*)(?:\s+using\s+(.+?))?(?:\s+giving back\s+(.+))?$/i))) {
        const inClass = cur() && cur().kind === 'class';
        if (stack.length && !inClass) inf.errs.push('Tools must be defined at the left edge (or inside a class), not inside another block.');
        if (!inClass) out = topOut;
        const ps = m[2] && !/^nothing$/i.test(m[2].trim()) ? splitItems(m[2]).map(p => param(p, x)) : [];   // ("using nothing": no inputs)
        let ret = m[3] ? typeOf(m[3], x) : null;
        if (m[3] && !ret) inf.errs.push(`I don't know the type "${m[3]}". Use whole number, decimal, text, yes/no, nothing, or a C++ type.`);
        if (A) {
          if (!ret) ret = blockGivesBack(lines, i) ? 'int' : 'void';
          if (ps.some(p => !p.type)) note(inf, 'Arduino tools need to know what kind of input they get. Inputs without a kind are taken as whole numbers (`int`); say "using decimal price" or "using text name" for others.');
          ps.forEach(p => { if (!p.type) p.type = 'int'; });
          note(inf, `A tool (a function) that gives back ${ret === 'void' ? 'nothing (`void`)' : code(ret)}.`);
        } else if (ps.some(p => p.type) || ret) {
          note(inf, 'A tool (a function) with its kinds of inputs and result spelled out.' + (ps.some(p => !p.type) || !ret ? ' Parts without a kind use `auto`.' : ''));
        } else {
          note(inf, 'A tool (a function). `auto` lets C++ work out the kinds of its inputs and result from how it is used.' + (inClass ? '' : ' Tools are placed above `main`, because C++ must see them before they are used.'));
        }
        ps.forEach(p => { x.types[p.name] = p.type || 'auto'; });
        open(`${ret || 'auto'} ${m[1]}(${ps.map(p => `${p.type || 'auto'} ${p.name}`).join(', ')})`, 'fn');
        ps.forEach(p => scopes[scopes.length - 1].add(p.name));
        return;
      }
      // --- Arduino: the two parts of a sketch
      if (A && (m = M(/^(?:when the board (?:starts|turns on|powers on|wakes up)|at the start|setup)$/i))) {
        if (stack.length) inf.errs.push('"when the board starts" goes at the left edge.');
        if (hasSetup) inf.errs.push('There is already a "when the board starts" part. A sketch has only one.');
        hasSetup = true;
        note(inf, '`setup()` runs once, when the board powers on or is reset: set up pins and the serial monitor here.');
        out = topOut;
        return open('void setup()', 'fn');
      }
      if (A && !stack.length && (m = M(/^(?:over and over(?: again)?|again and again|repeat forever|forever|keep repeating|loop)$/i))) {
        if (hasLoop) inf.errs.push('There is already an "over and over" part. A sketch has only one.');
        hasLoop = true;
        note(inf, '`loop()` runs again and again, forever, after setup: it is the heart of the sketch.');
        out = topOut;
        return open('void loop()', 'fn', { loopFn: true });
      }
      if (A && !stack.length && !/^(?:(?:set|let)\s+(?!pin\b|the (?:brightness|level|power)\b)[\w\s/:<>&*']+?\s+(?:to|be)\b|constant\s|(?:create|make)\s+(?:an?\s+)?(?:empty\s+)?list\b|make\s+(?:a\s+)?new\b|(?:create|make)\s+.+?\s+called\s+[A-Za-z_]\w*)/i.test(s)) {
        inf.errs.push('In a sketch, steps go inside "when the board starts" (once) or "over and over" (forever). Only settings like "set led to 13" go at the left edge.');
        return;
      }
      if ((m = M(/^(?:give back|return)\b\s*(.*)$/i))) {
        if (!inside('fn')) inf.errs.push('"give back" only works inside a tool (a define block).');
        // "give back total and count": two values, or a yes/no test that both are true?
        const parts = m[1] ? splitItems(m[1]) : [];
        if (parts.length > 1 && !/,/.test(m[1].replace(/"(?:[^"\\]|\\.)*"/g, '""')) && parts.every(p => !/\b(?:is|isn't|equals?|than|not|contains)\b|[=<>!]/i.test(p))) inf.errs.push(`"give back ${m[1].trim()}" could mean two values, or a yes/no test that both are true. A C++ tool gives back one value: give back each from its own tool, or put them in a list.`);
        return say(m[1] ? `return ${E(m[1], inf)};` : 'return;');
      }
      // return; said for what it does: in loop() the board starts the next round; in a tool, it leaves the tool
      if (/^skip the rest of this round$/i.test(s)) {
        if (!stack.some(b => b.loopFn)) inf.errs.push('"skip the rest of this round" only works inside "over and over".');
        note(inf, '`return;` leaves `loop()` here; the board then runs it again from the top, so the rest of this round is skipped.');
        return say('return;');
      }
      if (/^leave the tool now$/i.test(s)) {
        if (!inside('fn')) inf.errs.push('"leave the tool now" only works inside a tool (a define block).');
        note(inf, '`return;` leaves the tool here, giving nothing back; the steps after it in the tool are skipped.');
        return say('return;');
      }
      // --- switch: "depending on x" with "when it is 1" (or "1 or 2") and "otherwise" under it
      if ((m = M(/^depending on\s+(.+)$/i))) {
        note(inf, '`switch` picks the case that matches the value. Each case ends with `break;`, so only its own steps run.');
        return open(`switch (${E(m[1], inf)})`, 'switch', { cases: [] });
      }
      const inSwitch = cur() && cur().kind === 'switch';
      if ((m = M(/^when it(?:'s|\s+is)\s+(.+)$/i)) || (inSwitch && /^(?:otherwise|else)$/i.test(s))) {
        if (!inSwitch) { inf.errs.push('"when it is …" goes right under "depending on …", one step further in.'); return; }
        const sw = cur(), d = depthNow();
        const any = !m || /^anything else$/i.test(m[1].trim());
        const heads = any ? ['default:'] : splitPhrase(m[1], /\s+or\s+/i).map(v => `case ${E(v, inf)}:`);
        if (any && sw.hasDefault) inf.errs.push('There is already an "otherwise" here. A "depending on" has only one.');
        if (any) sw.hasDefault = true;
        heads.forEach(h => out.push({ text: '    '.repeat(d) + h, src: i }));
        stack.push({ ind, close: null, kind: 'case', src: i, buf: out, depth: d, head: out[out.length - 1], sw });
        scopes.push(new Set());
        return;
      }
      if (/^(?:go on|carry on) into the next case$/i.test(s)) {
        if (!cur() || cur().kind !== 'case') { inf.errs.push('"go on into the next case" goes last in a case ("when it is …").'); return; }
        cur().fall = true;
        note(inf, 'No `break;` at the end of this case, so C++ carries on with the steps of the next case.');
        return;
      }
      if (inSwitch) { inf.errs.push('Under "depending on …", each step goes in a case: "when it is …" or "otherwise".'); return; }
      if ((m = M(/^(?:otherwise if|else if)\s+(.+)$/i))) { out.push({ text: '    '.repeat(depth - 1) + `} else if (${EC(m[1], inf)}) {`, src: i }); return; }
      if (/^(?:otherwise|else)$/i.test(s)) { out.push({ text: '    '.repeat(depth - 1) + '} else {', src: i }); return; }
      if ((m = M(/^if\s+(.+)$/i))) return open(`if (${EC(m[1], inf)})`, 'if');
      if (/^(?:repeat forever|forever|keep repeating)$/i.test(s)) { note(inf, '`while (true)` repeats forever; "stop the loop" (break) gets out.'); return open('while (true)', 'loop'); }
      // a count that names a name made before it counts with that name (for (pos = 0; …)), and leaves it at the end value
      const counter = (v, named, inf2) => {
        if (named && isDeclared(v)) { note(inf2, `${code(v)} was made before, so the count uses it (no new \`int\`), and after the loop it keeps the value it ended on.`); return v; }
        x.types[v] = 'int';
        return `int ${v}`;
      };
      if ((m = M(/^repeat\s+(.+?)\s+times?(?:,?\s+counting with\s+([A-Za-z_]\w*))?$/i))) { const v = m[2] || 'i', n = E(m[1], inf), init = counter(v, !!m[2], inf); note(inf, `\`for (int ${v} = 0; ${v} < N; ${v}++)\` counts ${v} from 0 up to one less than N.`); open(`for (${init} = 0; ${v} < ${n}; ${v}++)`, 'loop'); scopes[scopes.length - 1].add(v); return; }
      // "count i from 1 up to but not including 10": i < 10
      if ((m = M(/^count(?:\s+up)?(?:\s+(?!from\b)([A-Za-z_]\w*))?\s+from\s+(.+?)\s+up to but not including\s+(.+?)(?:\s+(?:in steps of|by|step|stepping by)\s+(.+))?$/i))) {
        const v = m[1] || 'n', a = E(m[2], inf), b = E(m[3], inf), step = m[4] ? E(m[4], inf) : null, init = counter(v, !!m[1], inf);
        note(inf, `Counts up from ${a}${step ? ` in steps of ${step}` : ''} and stops before ${b} (the \`<\`).`);
        open(`for (${init} = ${a}; ${v} < ${b}; ${step ? `${v} += ${step}` : `${v}++`})`, 'loop');
        scopes[scopes.length - 1].add(v);
        return;
      }
      // "count i from 1 to 10", "count down from 10 to 1" (the count is n), "… in steps of 2"
      if ((m = M(/^count(?:\s+(up|down))?(?:\s+(?!from\b)([A-Za-z_]\w*))?\s+from\s+(.+?)\s+(down\s+)?to\s+(.+?)(?:\s+(?:in steps of|by|step|stepping by)\s+(.+))?$/i))) {
        const v = m[2] || 'n', a = m[3].trim(), b = m[5].trim(), num = (t) => /^-?\d+$/.test(t);
        const down = /down/i.test(m[1] || '') || !!m[4] || (!m[1] && num(a) && num(b) && +a > +b);   // "count up" always counts up
        // which way? only numbers written here say; otherwise ask (never count the wrong way)
        if (!m[1] && !m[4] && !num(a) && num(b)) inf.errs.push(`IntuaCode can't tell which way this counts, because ${code(a)} isn't a number written here. Say "count up ${v} from …" or "count down ${v} from …".`);
        if (!m[2]) note(inf, 'No name was given for the count, so it is called `n`. Write "count i from …" to choose a name.');
        const step = m[6] ? E(m[6], inf) : null, init = counter(v, !!m[2], inf);
        note(inf, `Counts ${down ? 'down' : 'up'}${step ? ` in steps of ${step}` : ''} and includes ${b} (the ${down ? '>=' : '<='}).`);
        open(`for (${init} = ${E(a, inf)}; ${v} ${down ? '>=' : '<='} ${E(b, inf)}; ${step ? `${v} ${down ? '-' : '+'}= ${step}` : `${v}${down ? '--' : '++'}`})`, 'loop');
        scopes[scopes.length - 1].add(v);
        return;
      }
      // "for each s in scores" reads each item (const auto&); "for each whole number s in scores" copies it into an int;
      // ", so it can be changed" works on the list's own item (auto&); ", as a copy" copies it (auto)
      if ((m = M(/^for each\s+(?:(.+?)\s+)?([A-Za-z_]\w*)\s+in\s+(.+?)(?:,\s*(so it can be changed|as a copy))?$/i))) {
        const [, typeWord, name, listWords, how] = m;
        const list = E(listWords, inf);
        let t = typeWord ? typeOf(typeWord, x) : null;
        if (typeWord && (!t || t === 'void')) { inf.errs.push(`I don't know the type "${typeWord}". Use whole number, decimal, text, yes/no, character, or a C++ type.`); t = 'auto'; }
        if (t && how && /copy/i.test(how)) inf.errs.push('Each item is already a copy when its type is said: leave out ", as a copy".');
        const decl = t ? (how && /changed/i.test(how) && !/&$/.test(t) ? `${t}&` : t) : how ? (/changed/i.test(how) ? 'auto&' : 'auto') : 'const auto&';
        x.types[name] = t ? t.replace(/^const\s+|&$/g, '') : (x.types[list] || '').replace(/^std::vector<(.+)>$/, '$1').replace(/\[\]$/, '') || 'auto';
        note(inf, decl === 'const auto&' ? '`for (const auto& item : list)` takes each item in turn. `const auto&` reads it without copying.'
          : /&$/.test(decl) ? `\`for (${decl} item : list)\` takes each item in turn, itself: changing it changes the list.` : `\`for (${decl} item : list)\` takes a copy of each item in turn: changing it doesn't change the list.`);
        open(`for (${decl} ${name} : ${list})`, 'loop');
        scopes[scopes.length - 1].add(name);
        return;
      }
      if ((m = M(/^(?:while|as long as)\s+(.+)$/i))) return open(`while (${EC(m[1], inf)})`, 'loop');
      // do … while: the steps run once before the test
      if ((m = M(/^do this,?\s+then repeat (?:while|as long as)\s+(.+)$/i))) {
        note(inf, '`do { … } while (…);` runs the steps once, then tests: they repeat while the test is true.');
        return open('do', 'loop', { close: `} while (${EC(m[1], inf)});` });
      }
      if (/^stop the loop$/i.test(s)) {
        const near = [...stack].reverse().find(b => b.kind === 'loop' || b.kind === 'case');
        if (near && near.kind === 'case') inf.errs.push('Inside "depending on", C++\'s `break` only leaves the case, not the loop around it. To stop the loop from here, set a yes/no value and test it after "depending on".');
        return say('break;');
      }
      if (/^skip to next$/i.test(s)) return say('continue;');
      // --- Arduino: pins, time, sound, serial monitor
      if (A) {
        const pin = (p) => (/^(?:the )?built-?in (?:light|led)$/i.test(p.trim()) ? 'LED_BUILTIN' : E(p.replace(/^pin\s+/i, ''), inf));
        if ((m = M(/^(?:make|set)\s+(?:pin\s+)?(.+?)\s+(?:an?|as(?:\s+an?)?)\s+(output|input)(\s+with (?:a )?pull-?up)?$/i))) {
          const mode = /output/i.test(m[2]) ? 'OUTPUT' : m[3] ? 'INPUT_PULLUP' : 'INPUT';
          note(inf, `\`pinMode\` sets a pin up as ${mode === 'OUTPUT' ? 'an output (the board sends power out, e.g. to an LED)' : mode === 'INPUT_PULLUP' ? 'an input with the built-in pull-up: it reads HIGH until a button connects it to ground' : 'an input (the board reads it, e.g. a button)'}.`);
          return say(`pinMode(${pin(m[1])}, ${mode});`);
        }
        // "turn pin LED on if lit, otherwise off": digitalWrite(LED, lit ? HIGH : LOW)
        if ((m = M(/^turn\s+(.+?)\s+(on|off)\s+if\s+(.+?),?\s+otherwise\s+(on|off)$/i))) {
          if (m[2].toLowerCase() === m[4].toLowerCase()) inf.warns.push(`It turns ${m[2].toLowerCase()} either way, so the test makes no difference.`);
          note(inf, '`digitalWrite` turns the pin on (HIGH) or off (LOW); `test ? HIGH : LOW` picks which, by the test.');
          const [yes, no] = [m[2], m[4]].map(w => (/on/i.test(w) ? 'HIGH' : 'LOW'));
          return say(`digitalWrite(${pin(m[1])}, ${EC(m[3], inf)} ? ${yes} : ${no});`);
        }
        if ((m = M(/^turn\s+servo\s+(.+?)\s+to\s+(.+?)\s+degrees?$/i))) {
          note(inf, '`write` turns a servo to an angle, from 0 to 180 degrees.');
          return say(`${E(m[1], inf)}.write(${E(m[2], inf)});`);
        }
        if ((m = M(/^turn\s+(on|off)\s+(.+)$/i)) || (m = M(/^turn\s+(.+?)\s+(on|off)$/i))) {
          const [on, p] = /^(on|off)$/i.test(m[1]) ? [m[1], m[2]] : [m[2], m[1]];
          note(inf, '`digitalWrite` turns a pin on (HIGH, 5 or 3.3 volts) or off (LOW, 0 volts).');
          return say(`digitalWrite(${pin(p)}, ${/on/i.test(on) ? 'HIGH' : 'LOW'});`);
        }
        if ((m = M(/^set\s+pin\s+(.+?)\s+to\s+(high|low|on|off)$/i))) return say(`digitalWrite(${pin(m[1])}, ${/high|on/i.test(m[2]) ? 'HIGH' : 'LOW'});`);
        // "set pin LED to ledState": on or off by a value (HIGH or LOW)
        if ((m = M(/^set\s+pin\s+(.+?)\s+to\s+(.+)$/i))) {
          if (/^\d+$/.test(m[2].trim()) && !/^[01]$/.test(m[2].trim())) inf.warns.push(`A pin set this way is only on or off (\`digitalWrite\`): any number but 0 turns it on. For a level from 0 to 255, say "set the brightness of pin ${m[1].trim()} to ${m[2].trim()}".`);
          note(inf, '`digitalWrite` turns the pin on (HIGH) or off (LOW), whichever the value is.');
          return say(`digitalWrite(${pin(m[1])}, ${E(m[2], inf)});`);
        }
        if ((m = M(/^(?:set the (?:brightness|level|power) of|dim)\s+(.+?)\s+to\s+(.+)$/i)) || (m = M(/^write\s+(.+?)\s+to\s+pin\s+(.+)$/i))) {
          const [p, v] = /^write/i.test(s) ? [m[2], m[1]] : [m[1], m[2]];
          note(inf, '`analogWrite` sets a level from 0 (off) to 255 (full), by switching the pin on and off very fast (PWM). Only pins marked ~ can do it.');
          return say(`analogWrite(${pin(p)}, ${E(v, inf)});`);
        }
        // "read pin A0 and call it level (a whole number)" makes level; "… and store it in level" can also change one made before
        if ((m = M(/^read\s+(analog\s+|digital\s+)?(?:pin\s+)?(.+?)\s+and\s+(store (?:it )?in|keep it as|call it)\s+([A-Za-z_]\w*)(?:\s+\(([^()]+)\))?$/i))) {
          const analog = /analog/i.test(m[1] || '') || (!m[1] && /^A\d+$/.test(m[2].trim()));
          note(inf, analog ? '`analogRead` measures the voltage on a pin as a number from 0 to 1023.' : '`digitalRead` reads a pin: HIGH (on) or LOW (off).');
          const call = `${analog ? 'analogRead' : 'digitalRead'}(${pin(m[2])})`;
          return say(keep(m[4], m[3], m[5], inf, call));
        }
        if ((m = M(/^attach\s+(.+?)\s+to\s+pin\s+(.+)$/i))) {
          note(inf, '`attach` connects a servo to the pin its signal wire is on.');
          return say(`${E(m[1], inf)}.attach(${pin(m[2])});`);
        }
        if ((m = M(/^wait\s+(?:for\s+)?(.+?)\s+(?:microseconds?|us|µs)$/i))) {
          note(inf, '`delayMicroseconds` pauses for millionths of a second: for timing a sensor\'s pulse. Up to about 16000; use "wait … milliseconds" for longer.');
          return say(`delayMicroseconds(${E(m[1].trim(), inf)});`);
        }
        if ((m = M(/^wait\s+(?:for\s+)?(.+?)\s+(milliseconds?|ms|seconds?|secs?)$/i))) {
          const secs = /^s/i.test(m[2]);
          const v = m[1].trim();
          const ms = !secs ? E(v, inf) : /^\d+(\.\d+)?$/.test(v) ? String(Math.round(parseFloat(v) * 1000)) : `${E(v, inf)} * 1000`;
          note(inf, '`delay` pauses the sketch for a number of milliseconds (1000 = 1 second). Nothing else happens while it waits.');
          return say(`delay(${ms});`);
        }
        if ((m = M(/^start (?:the serial monitor|talking to the computer)(?:\s+at\s+(\d+))?$/i))) {
          note(inf, '`Serial.begin` opens the connection to the computer over USB, at a speed in bits per second. The serial monitor must use the same speed.');
          return say(`Serial.begin(${m[1] || 9600});`);
        }
        if ((m = M(/^play\s+(?:a\s+)?(?:tone|note|sound)(?:\s+of)?\s+(.+?)\s+on\s+(?:pin\s+)?(.+?)(?:\s+for\s+(.+?)\s+milliseconds?)?$/i))) {
          note(inf, '`tone` makes a square-wave sound at a pitch in hertz (440 is the note A) on a buzzer pin' + (m[3] ? ', for a number of milliseconds.' : ', until "stop the tone".'));
          return say(`tone(${pin(m[2])}, ${E(m[1], inf)}${m[3] ? ', ' + E(m[3], inf) : ''});`);
        }
        if ((m = M(/^stop the (?:tone|note|sound) on\s+(?:pin\s+)?(.+)$/i))) return say(`noTone(${pin(m[1])});`);
        if (/^ask\b/i.test(s)) { inf.errs.push('An Arduino board has no keyboard to type answers on. Read a pin (a button or a sensor) instead: "read pin 2 and store in pressed".'); return; }
        // "scale reading from 0–1023 to 0–255 and store it in level": map(reading, 0, 1023, 0, 255)
        if ((m = M(/^scale\s+(.+?)\s+from\s+(.+?)\s*[–—]\s*(.+?)\s+to\s+(.+?)\s*[–—]\s*(.+?)\s+and\s+(store (?:it )?in|keep it as|call it)\s+([A-Za-z_]\w*)(?:\s+\(([^()]+)\))?$/i))) {
          note(inf, '`map` moves a value from one range to another: here from ' + `${m[2].trim()}–${m[3].trim()} to ${m[4].trim()}–${m[5].trim()}. It works in whole numbers, and doesn't stop at the ends (see "limited to").`);
          return say(keep(m[7], m[6], m[8], inf, `map(${[m[1], m[2], m[3], m[4], m[5]].map(v => E(v, inf)).join(', ')})`));
        }
      }
      // "keep level between 0 and 255": constrain (Arduino) or std::clamp (C++) stores it back
      if ((m = M(/^keep\s+(self\.[A-Za-z_]\w*|[A-Za-z_]\w*(?:(?:\.|->)[A-Za-z_]\w*)*)\s+between\s+(.+?)\s+and\s+(.+)$/i))) {
        const t = E(m[1], inf);
        if (!A) x.needs.add('algorithm');
        note(inf, `${A ? '`constrain`' : '`std::clamp`'} keeps ${code(t)} from going below the first number or above the second.`);
        return say(`${t} = ${A ? 'constrain' : 'std::clamp'}(${t}, ${E(m[2], inf)}, ${E(m[3], inf)});`);
      }
      // the keyboard: "read age from the keyboard" (std::cin >> age), "read a line from the keyboard into name"
      if ((m = M(/^read\s+(.+?)\s+from the keyboard$/i)) || (m = M(/^read a line from the keyboard into\s+(.+)$/i))) {
        if (A) { inf.errs.push('An Arduino board has no keyboard to type answers on. Read a pin (a button or a sensor) instead: "read pin 2 and store in pressed".'); return; }
        if (/^read a line/i.test(s)) { note(inf, '`std::getline` reads a whole line of typed text, spaces and all.'); return say(`std::getline(std::cin, ${E(m[1], inf)});`); }
        note(inf, '`std::cin >>` reads what the person types, up to a space or the end of the line, as the kind of value the name holds.');
        return say(`std::cin >> ${splitItems(m[1]).map(v => E(v, inf)).join(' >> ')};`);
      }
      if (/^end the line$/i.test(s)) {
        note(inf, A ? '`Serial.println()` with nothing in it ends the line on the serial monitor.' : '`std::endl` ends the line (and sends what was shown so far).');
        return say(A ? 'Serial.println();' : 'std::cout << std::endl;');
      }
      // printf: "show "%d tries\n" filled in with tries" (the % codes are filled in, in order)
      if ((m = M(/^show\s+("(?:[^"\\]|\\.)*")\s+filled in with\s+(.+)$/i))) {
        if (!A) x.needs.add('cstdio');
        note(inf, `\`${A ? 'Serial.printf' : 'printf'}\` fills in the % codes in the text, in order: %d a whole number, %f a decimal, %s text.` + (A ? ' Not every board has it (ESP32 boards do; an Uno doesn\'t).' : ''));
        return say(`${A ? 'Serial.printf' : 'printf'}(${m[1]}, ${splitItems(m[2]).map(v => E(v, inf)).join(', ')});`);
      }
      // a screen or another object that prints: "show "Hi" on lcd" (lcd.print), "…, then start a new line" (println)
      // "show the result of f with a, b": one value (the inputs aren't more things to show)
      const oneResult = (v) => /^(?:the\s+)?result of\s/i.test(v.trim()) && splitPhrase(v, /\s+followed by\s+/i).length === 1;
      if ((m = M(/^show\s+(.+?)\s+on\s+([A-Za-z_]\w*)(,?\s+then start a new line)?$/i))) {
        const items = oneResult(m[1]) ? [m[1]] : splitItems(m[1]);
        if (items.length > 1 && items.every(p => !/\b(?:is|isn't|equals?|than|not|contains)\b|[=<>!]/i.test(p.replace(/"(?:[^"\\]|\\.)*"/g, '""')))) inf.errs.push(`Show one thing at a time on ${m[2]}: one "show … on ${m[2]}" for each.`);
        note(inf, `\`${m[2]}.${m[3] ? 'println' : 'print'}\` shows the value on ${code(m[2])}` + (m[3] ? ', then moves to a new line.' : '.'));
        return say(`${m[2]}.${m[3] ? 'println' : 'print'}(${E(m[1], inf)});`);
      }
      if ((m = M(/^move\s+([A-Za-z_]\w*)'s cursor to\s+(.+)$/i))) {
        const at = splitItems(m[2], false);
        if (at.length !== 2) inf.errs.push(`Say where, as two numbers: "move ${m[1]}'s cursor to 0, 1".`);
        note(inf, `\`setCursor\` says where on ${code(m[1])} the next thing shown goes (a column and a row on a text screen, x and y on a pixel screen).`);
        return say(`${m[1]}.setCursor(${at.map(v => E(v, inf)).join(', ')});`);
      }
      if ((m = M(/^clear\s+([A-Za-z_]\w*)$/i))) { note(inf, `\`clear\` wipes ${code(m[1])}.`); return say(`${m[1]}.clear();`); }
      // "start lcd with 16, 2": begin (a library's own start-up, usually in "when the board starts")
      if ((m = M(/^start\s+(?!the\b|talking\b)([A-Za-z_]\w*)(?:\s+with\s+(.+))?$/i))) {
        note(inf, `\`begin\` starts ${code(m[1])} up${m[2] ? ', with the settings it needs' : ''}.`);
        return say(`${m[1]}.begin(${m[2] ? splitItems(m[2]).map(v => E(v, inf)).join(', ') : ''});`);
      }
      if ((m = M(/^show\s+(.+?)(\s+on the same line|\s+without ending the line)?$/i))) {
        const joined = splitPhrase(m[1], /\s+followed by\s+/i);
        // "show a is 1 and b is 2" is one test: "and" only separates plain values
        const items = oneResult(m[1]) ? [m[1]] : splitItems(m[1]);
        const plainOnly = items.every(p => !/\b(?:is|isn't|equals?|than|not|contains)\b|[=<>!]/i.test(p.replace(/"(?:[^"\\]|\\.)*"/g, '""')));
        const pieces = joined.length > 1 ? joined.map(v => E(v, inf)) : (plainOnly ? items : splitItems(m[1], false)).map(v => E(v, inf));
        const gap = joined.length > 1 ? '' : ' ';
        if (A) {
          if (!serialStarted) inf.warns.push('Start the serial monitor first ("start the serial monitor at 9600", in "when the board starts"), or nothing will show.');
          note(inf, '`Serial.println` sends a line to the computer\'s serial monitor.' + (pieces.length > 1 ? ' `Serial.print` sends a piece without ending the line.' : ''));
          const calls = [];
          pieces.forEach((p, k) => { if (k && gap) calls.push('Serial.print(" ");'); calls.push(`Serial.${k === pieces.length - 1 && !m[2] ? 'println' : 'print'}(${p});`); });
          return say(calls.join(' '));
        }
        note(inf, '`std::cout <<` writes to the terminal' + (pieces.length > 1 ? (gap ? ', with a space between the pieces' : ', one piece straight after another') : '') + (m[2] ? (/same line/i.test(m[2]) ? ', then a space, and the line goes on.' : '. The line goes on: nothing ends it.') : '; `std::endl` ends the line.'));
        // a comparison shown goes in brackets: std::cout << n == 3 doesn't build (<< comes first)
        return say('std::cout << ' + pieces.map(afterShift).join(gap ? ' << " " << ' : ' << ') + (!m[2] ? ' << std::endl;' : /same line/i.test(m[2]) ? ' << " ";' : ';'));
      }
      if ((m = M(/^ask(?:\s+for\s+(?:an?\s+)?(whole number|number|decimal))?\s+(.+?)\s+and store (?:it )?in\s+([A-Za-z_]\w*)$/i))) {
        const kind = (m[1] || '').toLowerCase();
        const type = /decimal/.test(kind) ? 'double' : /number/.test(kind) ? 'int' : 'std::string';
        const decl = isDeclared(m[3]) ? '' : `${type} ${m[3]}; `;
        scopes[scopes.length - 1].add(m[3]); x.types[m[3]] = type;
        say(`${decl}std::cout << ${afterShift(E(m[2], inf))};`);
        note(inf, type === 'std::string' ? '`std::getline` reads a whole line of typed text. `std::cin >> std::ws` first skips the end of any line left by an earlier number, which would otherwise read as an empty answer.' : '`std::cin >>` reads a number typed by the person.');
        return say(type === 'std::string' ? `std::getline(std::cin >> std::ws, ${m[3]});` : `std::cin >> ${m[3]};`);
      }
      // "make a list of whole numbers called scores with 7, 9"; "… of 4 whole numbers …" has a fixed size (a plain array)
      if ((m = M(/^(?:create|make)\s+(?:an?\s+)?(empty\s+)?list(?:\s+of\s+(.+?))?\s+(?:called\s+)?([A-Za-z_]\w*)(?:\s+with\s+(.+))?$/i))) {
        const [, empty, of, name, said] = m;
        // "of 4 whole numbers": a size first (digits, or a CONSTANT in capitals), then what it holds
        const sized = of && of.match(/^(\d+|[A-Z_][A-Z0-9_]*)\s+(.+)$/);
        const [size, what] = sized && itemType(sized[2], x) ? [sized[1], sized[2]] : [null, of];
        const items = said ? splitItems(said).map(v => E(v, inf)) : [];
        const t0 = what ? itemType(what, x) : items.length ? exprType(items[0], x) : null;
        if (!t0) { inf.errs.push(what ? `I don't know the type "${what}". Say "list of whole numbers", "list of text", or a C++ type and "values", like "list of float values".` : 'C++ needs to know what the list will hold. Say "create list of numbers …" or "list of text …".'); return; }
        if (empty && items.length) inf.errs.push('An empty list has no items: leave out "empty", or the "with …".');
        const t = fixText(t0 === 'auto' ? 'int' : t0, x);
        scopes[scopes.length - 1].add(name);
        if (size || A) {
          if (!size && !items.length) { inf.errs.push('An Arduino list has a fixed size, so give it its items: "create list of numbers called pins with 2, 3, 4", or its size: "make a list of 4 whole numbers called readings".'); return; }
          if (size && /^\d+$/.test(size) && items.length > +size) inf.errs.push(`${items.length} items don't fit in a list of ${size}.`);
          x.types[name] = t + '[]';
          note(inf, `A list ${A ? 'on Arduino ' : 'with a size '}is a plain array: a fixed number of ${code(t)} values. It can't grow${A ? ', which saves the board\'s small memory' : ''}.` + (size && !items.length ? ' Its items are whatever was in memory (0 for a list made outside every block) until set.' : ''));
          return say(`${t} ${name}[${size || ''}]${items.length ? ` = {${items.join(', ')}}` : ''};`);
        }
        const type = `std::vector<${t}>`;
        x.needs.add('vector');
        x.types[name] = type;
        note(inf, `A list in C++ is a \`std::vector\`, and every item has the same kind: ${code(t)}.` + (items.length ? '' : ' It starts empty.'));
        return say(items.length ? `${type} ${name} = {${items.join(', ')}};` : `${type} ${name};`);
      }
      // "make a whole number called count", "make empty text called name", "make a Servo called arm", "make a LiquidCrystal called lcd with 12, 11"
      if ((m = M(/^(?:create|make)\s+(?:an?\s+|some\s+)?(empty\s+)?(?:new\s+)?(.+?)\s+called\s+([A-Za-z_]\w*)(?:\s+with\s+(.+))?$/i))) {
        const [, empty, typeWords, name, said] = m;
        // a type word, or a class: one defined here, or a library's (Servo, LiquidCrystal…), which starts with a capital or has ::
        const word = typeOf(typeWords, x), cls = !word && /^(?:[A-Z][\w]*|[A-Za-z_]\w*(?:::[A-Za-z_]\w*)+)(?:<.+>)?$/.test(typeWords.trim()) ? typeWords.trim() : null;
        const t = word || cls;
        if (!t || t === 'void') { inf.errs.push(`I don't know the type "${typeWords}". Use whole number, decimal, text, yes/no, character, a C++ type, or a class.`); return; }
        const isText = /^(?:std::string|String)$/.test(t);
        const plainValue = /^(?:(?:unsigned|signed)\s+)?(?:int|long|long long|short|double|float|bool|char|size_t|byte|u?int\d+_t|unsigned)$/.test(t);
        if (empty && !isText) inf.errs.push(`Only text and lists start out "empty": say "make a ${typeWords} called ${name}".`);
        if (said && plainValue) inf.errs.push(`A ${typeWords} is given its value with "set": "set ${name} to …".`);
        if (scopes[scopes.length - 1].has(name)) inf.errs.push(`${code(name)} is already made here.`);
        const args = said ? splitItems(said).map(v => E(v, inf)) : [];
        scopes[scopes.length - 1].add(name); x.types[name] = t; x.known.add(name);
        note(inf, !plainValue && !isText ? `Makes a ${code(t)} called ${code(name)}` + (args.length ? ', passing the values to it as it is made.' : '.') : isText ? `${code(name)} holds text (${code(t)}), starting empty.` : `${code(name)} holds ${code(t)} values. It has no value until one is set (outside every block, it starts at 0).`);
        return say(`${t} ${name}${args.length ? `(${args.join(', ')})` : ''};`);
      }
      if ((m = M(/^add\s+(.+?)\s+to\s+([A-Za-z_]\w*)$/i))) {
        if (/^std::vector/.test(x.types[m[2]] || '')) {
          // "add "milk" and "eggs" to basket" adds both (and between plain values), one push_back each
          const vals = splitItems(m[1]);
          const many = vals.length > 1 && vals.every(p => !/\b(?:is|isn't|equals?|than|not|contains)\b|[=<>!]/i.test(p.replace(/"(?:[^"\\]|\\.)*"/g, '""')));
          note(inf, '`push_back` adds to the end of a vector.' + (many ? ' Each value gets its own.' : ''));
          return say((many ? vals : [m[1]]).map(v => `${m[2]}.push_back(${E(v, inf)});`).join(' '));
        }
        if (/\[\]$/.test(x.types[m[2]] || '')) { inf.errs.push('Arduino lists have a fixed size, so nothing can be added. Make the list with all its items instead.'); return; }
        return say(`${m[2]} += ${E(m[1], inf)};`);
      }
      if ((m = M(/^(increase|decrease)\s+(.+?)(?:\s+by\s+(.+))?$/i))) {
        const up = /^increase$/i.test(m[1]);
        if (m[3]) return say(`${E(m[2], inf)} ${up ? '+' : '-'}= ${E(m[3], inf)};`);
        note(inf, `No amount given, so it goes ${up ? 'up' : 'down'} by 1: \`${up ? '++' : '--'}\` ${up ? 'adds' : 'takes away'} 1.`);
        return say(`${E(m[2], inf)}${up ? '++' : '--'};`);
      }
      if ((m = M(/^(multiply|divide)\s+(.+?)\s+by\s+(.+)$/i))) {
        const t = E(m[2], inf), by = E(m[3], inf), times = /^multiply$/i.test(m[1]);
        if (!times && /^(?:int|long|unsigned|short)/.test(x.types[t] || '') && !/\./.test(by)) inf.warns.push(`${code(t)} holds whole numbers, so dividing keeps only the whole part (7 / 2 is 3). Make it a decimal to keep the rest.`);
        note(inf, `\`${times ? '*=' : '/='}\` is short for ${code(`${t} = ${t} ${times ? '*' : '/'} ${by}`)}.`);
        return say(`${t} ${times ? '*=' : '/='} ${by};`);
      }
      if ((m = M(/^make\s+(?:a\s+)?new\s+([A-Za-z_]\w*)(?:\s+with\s+(.+?))?\s+and store (?:it )?in\s+([A-Za-z_]\w*)$/i))) {
        if (!x.classes.has(m[1])) inf.warns.push(`There's no class called ${code(m[1])} here. Make one with "define class ${m[1]}".`);
        const args = m[2] ? splitItems(m[2]).map(v => E(v, inf)) : [];
        x.types[m[3]] = m[1]; scopes[scopes.length - 1].add(m[3]);
        note(inf, `Makes a new ${code(m[1])} object called ${code(m[3])}` + (args.length ? ', passing the values to its "when made" part.' : '.'));
        return say(`${m[1]} ${m[3]}${args.length ? `(${args.join(', ')})` : ''};`);
      }
      if ((m = M(/^run\s+([A-Za-z_][\w.:>-]*)(?:\s+with\s+(.+?))?(?:\s+and store (?:it |the result )?in\s+([A-Za-z_]\w*))?$/i))) {
        const name = m[1].replace(/^self\./, 'this->');
        const call = `${name}(${m[2] ? splitItems(m[2]).map(v => E(v, inf)).join(', ') : ''})`;
        unknownTool(m[1], x, inf);
        return say(m[3] ? declare(m[3], 'auto', inf, call) : call + ';');
      }
      // one item of a list: "set item 0 of scores to 5", "set the last item of scores to 0"
      if ((m = M(/^(?:set|change)\s+(?:the\s+)?(?:(first|last)\s+item|item\s+(.+?))\s+(?:of|in)\s+([A-Za-z_]\w*(?:(?:\.|->)[A-Za-z_]\w*)*)\s+to\s+(.+)$/i))) {
        const list = E(m[3], inf), at = m[1] ? (/first/i.test(m[1]) ? '0' : null) : E(m[2], inf);
        note(inf, `Square brackets pick one item of ${code(list)} by its position (the first is 0), and \`=\` replaces it.`);
        if (at == null) return say(/\[\]$/.test(x.types[m[3]] || '') ? `${list}[sizeof(${list}) / sizeof(${list}[0]) - 1] = ${E(m[4], inf)};` : `${list}.back() = ${E(m[4], inf)};`);
        return say(`${list}[${at}] = ${E(m[4], inf)};`);
      }
      if ((m = M(/^(?:set|let|make)\s+(self\.[A-Za-z_]\w*|[A-Za-z_]\w*(?:(?:\.|->)[A-Za-z_]\w*)+|[A-Za-z_]\w*\[.+\])\s+(?:to|be)\s+(.+)$/i))) {
        return say(`${E(m[1], { ...inf, warns: [] })} = ${E(m[2], inf)};`);
      }
      if ((m = M(/^constant\s+(?:(.+?)\s+)?([A-Za-z_]\w*)\s+(?:is|=)\s+(.+)$/i))) {
        const v = E(m[3], inf);
        const t = m[1] ? typeOf(m[1], x) : exprType(v, x);
        if (!t) { inf.errs.push(`I don't know the type "${m[1]}". Use whole number, decimal, text, yes/no, or a C++ type.`); return; }
        scopes[scopes.length - 1].add(m[2]); x.types[m[2]] = t;
        note(inf, `\`const\` makes ${code(m[2])} a constant: it keeps this value for good, and C++ stops the program from being built if anything tries to change it.`);
        return say(`const ${t} ${m[2]} = ${v};`);
      }
      if ((m = M(/^(?:set|let)\s+(.+?)\s+([A-Za-z_]\w*)\s+(?:to|be)\s+(.+)$/i)) && typeOf(m[1], x) && !isDeclared(m[2])) {
        const t = typeOf(m[1], x), v = E(m[3], inf);
        scopes[scopes.length - 1].add(m[2]); x.types[m[2]] = t;
        note(inf, `${code(m[2])} holds ${code(t)} values, as the sentence says.`);
        return say(`${t} ${m[2]} = ${v};`);
      }
      if ((m = M(/^(?:set|let|make)\s+([A-Za-z_]\w*)\s+(?:to|be)\s+(.+)$/i))) {
        if (/^(?:nothing|none)$/i.test(m[2].trim())) { inf.errs.push(`A plain value in C++ always holds something, so it can't be set to nothing. Use 0, empty text (""), or a yes/no value like "set ${m[1]} to no".`); return; }
        const v = E(m[2], inf);
        return say(declare(m[1], isDeclared(m[1]) ? x.types[m[1]] : exprType(v, x), inf, v));
      }
      if (/^stop the program$/i.test(s)) {
        if (A) { note(inf, 'A board never really stops, so this waits forever (until it is reset).'); return say('while (true) {}'); }
        if (inside('fn')) { x.needs.add('exit'); return say('std::exit(0);'); }
        return say('return 0;');
      }
      inf.errs.push(`I don't recognise this sentence. Open the Index to see the ${A ? 'Arduino' : 'C++'} sentences, or start the line with c++: to write C++ directly.`);
      say('// ??? ' + s);
    });
    while (stack.length) closeBlock();
    if (A) {
      if (!hasSetup) topOut.push({ text: '', src: -1 }, { text: 'void setup() {', src: -1, note: 'Every sketch needs setup(), even an empty one.' }, { text: '}', src: -1 });
      if (!hasLoop) topOut.push({ text: '', src: -1 }, { text: 'void loop() {', src: -1, note: 'Every sketch needs loop(), even an empty one.' }, { text: '}', src: -1 });
    }
    // assemble: includes, helpers, classes and tools, main
    const all = [];
    const hdr = (text, noteText, src = -1) => all.push({ text, src, note: noteText });
    if (!A) {
      hdr('#include <iostream>', 'Lets the program write to and read from the terminal.');
      hdr('#include <string>', 'Lets the program use text (std::string).');
      if (x.needs.has('vector')) hdr('#include <vector>', 'Lets the program use lists (std::vector).');
      if (x.needs.has('random')) hdr('#include <random>', 'Random numbers.');
      if (x.needs.has('text')) hdr('#include <sstream>', 'Builds text from pieces.');
      if (x.needs.has('exit')) hdr('#include <cstdlib>', 'Lets a tool stop the whole program (std::exit).');
      if (x.needs.has('algorithm')) hdr('#include <algorithm>', 'Ready-made steps for values and lists (std::clamp).');
      if (x.needs.has('cstdio')) hdr('#include <cstdio>', 'printf: text with % codes filled in.');
    }
    const auto = new Set(all.map(o => o.text.slice(9)));
    for (const inc of includes) if (!auto.has(inc.h)) hdr(`#include ${inc.h}`, null, inc.src);
    if (usingStd != null) hdr('using namespace std;', null, usingStd);
    if (all.length) hdr('', null);
    if (x.needs.has('random')) [...HELPERS.random, ''].forEach(t => hdr(t, 'A helper for "random number from … to …": picks a whole number between low and high, both included.'));
    if (x.needs.has('text')) [...HELPERS.text, ''].forEach(t => hdr(t, 'A helper for text with {…} in it: joins the pieces and values into one std::string.'));
    while (topOut.length && topOut[0].text === '') topOut.shift();
    if (topOut.length) { topOut.forEach(o => all.push(o)); if (!A) all.push({ text: '', src: -1 }); }
    while (mainOut.length && mainOut[0].text.trim() === '') mainOut.shift();
    if (!A) {
      all.push({ text: 'int main() {', src: -1, note: 'Every C++ program starts in `main`.' });
      mainOut.forEach(o => all.push(o));
      all.push({ text: '    return 0;', src: -1, note: 'Giving back 0 tells the computer the program finished without problems.' });
      all.push({ text: '}', src: -1 });
    }
    while (all.length && all[all.length - 1].text === '') all.pop();
    all.forEach((o, idx) => { if (o.src >= 0) info[o.src].py.push(idx); });
    return { lines: all, info, text: all.map(o => o.text).join('\n') + '\n' };
  }

  function compileCppProject(project) {
    const arduino = project.kind === 'arduino';
    const x = { types: {}, fns: new Set(), classes: new Set(), known: new Set(), needs: new Set(), arduino };
    const results = {};
    for (const sec of project.sections) {
      const h = holdBlanks(sec.text);
      results[sec.id] = compileCpp({ ...sec, text: h.text }, x);
      reportBlanks(results[sec.id].info, h.blanks, h.strays);
    }
    const syms = new Map();
    for (const [k, t] of Object.entries(x.types)) syms.set(k, { py: k, display: k, kind: /int|double|long/.test(t) ? 'number' : /string|String/.test(t) ? 'text' : /vector|\[\]/.test(t) ? 'list' : 'value' });
    for (const f of x.fns) syms.set(f, { py: f, display: f, kind: 'function' });
    for (const c of x.classes) syms.set(c, { py: c, display: c, kind: 'class' });
    return { results, syms };
  }

  const T = (group, pattern, c, tip, sections = ['program']) => ({ group, pattern, py: c, tip, sections });
  const TEMPLATES = [
    T('Values', 'set ‹name› to ‹value›', 'int name = value;', 'The kind (int, double, std::string, bool) is worked out from the value.', ['program', 'sketch']),
    T('Values', 'constant ‹NAME› is ‹value›', 'const int NAME = value;', 'A value that never changes. Say the kind too if you like: "constant decimal PI is 3.14".', ['program', 'sketch']),
    T('Values', 'set ‹decimal› ‹name› to ‹value›', 'double name = value;', 'Name the kind yourself: whole number, decimal, text, yes/no.', ['program', 'sketch']),
    T('Values', 'increase ‹name› by ‹amount›', 'name += amount;', '', ['program', 'sketch']),
    T('Values', 'multiply ‹name› by ‹amount›', 'name *= amount;', 'Also "divide ‹name› by ‹amount›" (/=).', ['program', 'sketch']),
    T('Values', 'make a ‹whole number› called ‹count›', 'int count;', 'A name with no value yet. Also "make empty text called name", "make a yes/no value called done".', ['program', 'sketch']),
    T('Values', 'make a ‹LiquidCrystal› called ‹lcd› with ‹12, 11, 5, 4, 3, 2›', 'LiquidCrystal lcd(12, 11, 5, 4, 3, 2);', 'An object of a class or a library, given what it needs to start. Leave off "with …" if it needs nothing: "make a Servo called arm".', ['program', 'sketch']),
    T('Values', 'keep ‹level› between ‹0› and ‹255›', 'level = std::clamp(level, 0, 255);', 'Stops it going below the first number or above the second.'),
    T('Values', 'keep ‹level› between ‹0› and ‹255›', 'level = constrain(level, 0, 255);', 'Stops it going below the first number or above the second.', ['sketch']),
    T('Values', 'let ‹LED› stand for ‹13›', '#define LED 13', 'A name swapped for its value before compiling. "constant LED is 13" does the same, with a type.', ['program', 'sketch']),
    T('Show & ask', 'show ‹value›', 'std::cout << value << std::endl;', 'Join several things with "and" (a space between) or "followed by" (no space).'),
    T('Show & ask', 'show ‹value› without ending the line', 'std::cout << value;', 'What is shown next carries on the same line. "end the line" ends it.'),
    T('Show & ask', 'end the line', 'std::cout << std::endl;', ''),
    T('Show & ask', 'show "‹%d tries›" filled in with ‹tries›', 'printf("%d tries", tries);', 'The % codes are filled in, in order: %d a whole number, %f a decimal, %s text.'),
    T('Show & ask', 'ask for a number "‹question›" and store in ‹name›', 'std::cin >> name;', 'Or "ask … and store in …" for text.'),
    T('Show & ask', 'read ‹age› from the keyboard', 'std::cin >> age;', 'What the person types, up to a space. "read a line from the keyboard into ‹name›" reads a whole line.'),
    T('Show & ask', 'read a line from the keyboard into ‹name›', 'std::getline(std::cin, name);', 'A whole line of typed text, spaces and all.'),
    T('Decisions', 'if ‹condition›', 'if (condition) {', '', ['program', 'sketch']),
    T('Decisions', 'otherwise', '} else {', '', ['program', 'sketch']),
    T('Decisions', 'depending on ‹value›', 'switch (value) {', 'Under it, one step in: "when it is 1", "when it is 2 or 3", "otherwise".', ['program', 'sketch']),
    T('Decisions', 'when it is ‹1›', 'case 1:', 'Inside "depending on". Each case ends by itself (break); "go on into the next case" carries on instead.', ['program', 'sketch']),
    T('Loops', 'repeat ‹number› times', 'for (int i = 0; i < number; i++) {', '', ['program', 'sketch']),
    T('Loops', 'repeat ‹10› times, counting with ‹i›', 'for (int i = 0; i < 10; i++) {', 'i goes from 0 to 9. A name made before is used as the count.', ['program', 'sketch']),
    T('Loops', 'count ‹i› from ‹1› to ‹10›', 'for (int i = 1; i <= 10; i++) {', 'Add "in steps of 2" to skip. "count down i from 10 to 1" counts down.', ['program', 'sketch']),
    T('Loops', 'count ‹i› from ‹0› up to but not including ‹n›', 'for (int i = 0; i < n; i++) {', '', ['program', 'sketch']),
    T('Loops', 'for each ‹item› in ‹list›', 'for (const auto& item : list) {', 'Add ", so it can be changed" to change the items themselves.', ['program', 'sketch']),
    T('Loops', 'for each ‹whole number› ‹v› in ‹list›', 'for (int v : list) {', 'Each item copied into a name of that type.', ['program', 'sketch']),
    T('Loops', 'while ‹condition›', 'while (condition) {', '', ['program', 'sketch']),
    T('Loops', 'do this, then repeat while ‹condition›', 'do { … } while (condition);', 'The steps run once before the test.', ['program', 'sketch']),
    T('Loops', 'repeat forever', 'while (true) {', 'Pair with "stop the loop".'),
    T('Lists', 'make a list of ‹whole numbers› called ‹name› with ‹1, 2, 3›', 'std::vector<int> name = {1, 2, 3};', 'Also "list of text", "list of decimals". Leave off "with …" for an empty list.'),
    T('Lists', 'make a list of ‹whole numbers› called ‹name› with ‹1, 2, 3›', 'int name[] = {1, 2, 3};', 'Also "list of text", "list of decimals".', ['sketch']),
    T('Lists', 'make a list of ‹4› ‹whole numbers› called ‹readings›', 'int readings[4];', 'A fixed number of items. Add "with 0, 0, 0, 0" to give them.', ['program', 'sketch']),
    T('Lists', 'add ‹value› to ‹list›', 'list.push_back(value);', ''),
    T('Lists', 'set item ‹0› of ‹list› to ‹value›', 'list[0] = value;', 'Positions start at 0. Also "set the last item of ‹list› to ‹value›".', ['program', 'sketch']),
    T('Tools', 'define ‹name› using ‹inputs›', 'auto name(auto inputs) {', 'Tools go above main automatically.', ['program', 'sketch']),
    T('Tools', 'define ‹name› using ‹decimal w›, ‹decimal h› giving back ‹a decimal›', 'double name(double w, double h) {', 'Name the kinds: whole number, decimal, text, yes/no, nothing.', ['program', 'sketch']),
    T('Tools', 'define ‹average› using read-only ‹list of whole numbers› ‹values› giving back ‹a decimal›', 'double average(const std::vector<int>& values) {', '"read-only" looks at the caller\'s value without copying it; "the caller\'s" lets the tool change it.'),
    T('Tools', 'give back ‹value›', 'return value;', '', ['program', 'sketch']),
    T('Tools', 'leave the tool now', 'return;', 'Leaves a tool that gives nothing back.', ['program', 'sketch']),
    T('Tools', 'run ‹tool› with ‹inputs› and store in ‹name›', 'auto name = tool(inputs);', '', ['program', 'sketch']),
    T('Classes', 'define class ‹Name›', 'class Name { public: … };', 'A blueprint for objects. Indent its fields and tools under it.', ['program', 'sketch']),
    T('Classes', 'define structure ‹Point›', 'struct Point { … };', 'Named values bundled together, all public. Fields go under it.', ['program', 'sketch']),
    T('Classes', 'field ‹name›: ‹text›', 'std::string name;', 'Inside a class. Also "has whole number count starting at 0".', ['program', 'sketch']),
    T('Classes', 'when made using ‹text name›', 'Name(std::string name) {', 'Inside a class: runs when a new object is made. Use "set self.name to name".', ['program', 'sketch']),
    T('Classes', 'make a new ‹Class› with ‹inputs› and store in ‹name›', 'Class name(inputs);', 'Creates an object from a class. Also "make a ‹Class› called ‹name› with ‹inputs›".', ['program', 'sketch']),
    T('Program', 'include ‹cmath›', '#include <cmath>', 'Brings in a library.', ['program', 'sketch']),
    T('Program', 'above main: ‹C++ code›', 'code (outside main)', 'C++ copied exactly, outside main.'),
    T('Other', 'c++: ‹code›', 'code', 'Write C++ directly.', ['program', 'sketch']),
    T('Board', 'when the board starts', 'void setup() {', 'Runs once, when the board powers on.', ['sketch']),
    T('Board', 'over and over', 'void loop() {', 'Runs again and again, forever.', ['sketch']),
    T('Board', 'skip the rest of this round', 'return;', 'In "over and over": the board starts the next round from the top.', ['sketch']),
    T('Pins', 'make pin ‹13› an output', 'pinMode(13, OUTPUT);', 'Also "an input", "an input with pull-up".', ['sketch']),
    T('Pins', 'turn pin ‹13› on', 'digitalWrite(13, HIGH);', 'And "turn pin 13 off". "the built-in light" is LED_BUILTIN.', ['sketch']),
    T('Pins', 'set pin ‹led› to ‹state›', 'digitalWrite(led, state);', 'On or off by a value (HIGH or LOW).', ['sketch']),
    T('Pins', 'turn pin ‹led› on if ‹lit›, otherwise off', 'digitalWrite(led, lit ? HIGH : LOW);', '', ['sketch']),
    T('Pins', 'set the brightness of pin ‹9› to ‹128›', 'analogWrite(9, 128);', '0 to 255, on pins marked ~.', ['sketch']),
    T('Pins', 'read pin ‹A0› and call it ‹level› (a whole number)', 'int level = analogRead(A0);', 'A0 to A5 read 0 to 1023; other pins read on or off (digitalRead). "read analog pin SENSOR" for a named analog pin; "… and store it in level" changes a name made before.', ['sketch']),
    T('Pins', 'scale ‹reading› from ‹0›–‹1023› to ‹0›–‹255› and store it in ‹level›', 'level = map(reading, 0, 1023, 0, 255);', 'Moves a value from one range to another. Also "… and call it level (a whole number)".', ['sketch']),
    T('Pins', 'set ‹duration› to how long pin ‹echo› stays on', 'duration = pulseIn(echo, HIGH);', 'In microseconds: for distance sensors.', ['sketch']),
    T('Time', 'wait ‹500› milliseconds', 'delay(500);', 'Or "wait 2 seconds".', ['sketch']),
    T('Time', 'wait ‹10› microseconds', 'delayMicroseconds(10);', 'Millionths of a second, for timing a sensor\'s pulse.', ['sketch']),
    T('Time', 'if at least ‹500› milliseconds have passed since ‹last›', 'if (millis() - last >= 500) {', 'On time without stopping the board. Also "more than", "less than", "at most".', ['sketch']),
    T('Serial', 'start the serial monitor at ‹9600›', 'Serial.begin(9600);', 'Put it in "when the board starts".', ['sketch']),
    T('Serial', 'show ‹value›', 'Serial.println(value);', 'Shows in the serial monitor. "show a followed by b" shows them on one line.', ['sketch']),
    T('Serial', 'show ‹value› on the same line', 'Serial.print(value);', 'What is shown next carries on the line. "end the line" ends it.', ['sketch']),
    T('Serial', 'end the line', 'Serial.println();', '', ['sketch']),
    T('Screens', 'start ‹lcd› with ‹16, 2›', 'lcd.begin(16, 2);', 'A library\'s start-up, in "when the board starts". "start pixels" if it needs nothing.', ['sketch']),
    T('Screens', 'show ‹value› on ‹lcd›', 'lcd.print(value);', 'Add ", then start a new line" to move down a line (println).', ['sketch']),
    T('Screens', 'move ‹lcd›\'s cursor to ‹0, 1›', 'lcd.setCursor(0, 1);', 'Where the next thing shown goes: column and row on a text screen.', ['sketch']),
    T('Screens', 'clear ‹lcd›', 'lcd.clear();', '', ['sketch']),
    T('Motors', 'attach ‹arm› to pin ‹9›', 'arm.attach(9);', 'Make the servo first: "make a Servo called arm".', ['sketch']),
    T('Motors', 'turn servo ‹arm› to ‹90› degrees', 'arm.write(90);', '0 to 180.', ['sketch']),
    T('Sound', 'play a tone of ‹440› on pin ‹8› for ‹200› milliseconds', 'tone(8, 440, 200);', '', ['sketch']),
  ];
  const GUIDE = {
    name: 'C++', section: 'The program runs from the top of main. Tools and classes you define are placed above it automatically.',
    purpose: 'C++ is a fast language that is close to the hardware. It runs games, browsers, operating systems, and small devices like Arduino boards. The price of the speed: every value has a fixed kind (a type), and the program must be compiled (translated to machine code) before it runs.',
    rules: [['Types are fixed', 'A value declared as int stays a whole number. Text is std::string, decimals are double.'], ['Compile, then run', 'A compiler (g++, clang++ or Visual Studio\'s cl) checks the whole program and turns it into an app first.'], ['Semicolons end statements', 'Each instruction ends with ;. Blocks go in { braces }.'], ['main is the start', 'Every program begins in int main().'], ['Classes', 'A class bundles values (fields) and tools (methods) into one kind of object.'], ['Memory is your job', 'Lists (std::vector) and text (std::string) manage memory for you; raw new/delete don\'t.']],
  };
  const ARDUINO_GUIDE = {
    name: 'Arduino', section: 'Lines at the left edge are the sketch\'s settings (pins, starting values). "when the board starts" runs once; "over and over" runs forever.',
    purpose: 'Arduino is C++ for small boards that switch lights, read buttons and sensors, drive motors and make sounds. A sketch has two parts: setup(), which runs once when the board powers on, and loop(), which runs again and again until the power goes off.',
    rules: [['Two parts', 'setup() runs once; loop() repeats forever. There is no main.'], ['Pins', 'Each pin is set up as an input or an output first, then turned on (HIGH) or off (LOW), or read.'], ['Waiting', 'delay() pauses everything. For doing two things at once, compare millis() instead.'], ['Tiny memory', 'An Uno has 2 KB of memory. Lists have a fixed size, and text is kept short.'], ['Upload, then watch', 'The sketch is compiled and copied onto the board. show sends lines back to the serial monitor.']],
  };
  const WORDS = [['a is b', 'a == b'], ['a is not b', 'a != b'], ['a and b', 'a && b'], ['not a', '!a'], ['a is even', 'a % 2 == 0'], ['a is odd', 'a % 2 != 0'], ['length of x', 'x.size()'], ['item 0 of x', 'x[0]'], ['random number from 1 to 6', 'random_number(1, 6)'], ['x as number', 'std::stoi(x)'], ['x as text', 'std::to_string(x)'], ['"Hi {name}"', 'text("Hi ", name)'], ['self.name', 'this->name'], ['a followed by b', 'a << b'], ['x limited to 0–255', 'std::clamp(x, 0, 255)']];
  const ARDUINO_WORDS = [['pin 2 is on', 'digitalRead(2) == HIGH'], ['reading of pin A0', 'analogRead(A0)'], ['time since start', 'millis()'], ['at least 500 milliseconds have passed since last', 'millis() - last >= 500'], ['x scaled from 0–1023 to 0–255', 'map(x, 0, 1023, 0, 255)'], ['x limited to 0–255', 'constrain(x, 0, 255)'], ['how long pin 7 stays on', 'pulseIn(7, HIGH)'], ['the built-in light', 'LED_BUILTIN'], ['random number from 1 to 6', 'random(1, 7)'], ['x as number', 'x.toInt()'], ['x as text', 'String(x)'], ['"Hi {name}"', 'String("Hi ") + name']];
  const OPENS_BLOCK = /^\s*(?:if |otherwise|else|repeat |count |for each |while |define |as long as |forever|keep repeating|when (?:made|created|built|the board|it is |it's )|over and over|again and again|at the start|depending on |do this)/i;

  const api = { compileCppProject, TEMPLATES, GUIDE, ARDUINO_GUIDE, WORDS, ARDUINO_WORDS, OPENS_BLOCK, HELPERS, typeOf: (w, arduino) => typeOf(w, { classes: new Set(), needs: new Set(), arduino }) };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.IntuiCpp = api;
})(typeof window !== 'undefined' ? window : globalThis);

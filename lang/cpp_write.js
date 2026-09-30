/* IntuiCode — C++ language pack: sentences -> C++ (and Arduino sketches).
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
  const FILLER = /^(?:(?:please|now|next|then|and then|also|just|i want to|i'd like to|let's|let us|go ahead and)\s*,?\s+)+/i;
  const RAW = /^(?:c\+\+|cpp|raw)\s*:\s?(.*)$/i;
  const ABOVE = /^(?:above main|outside main|at the top)\s*:\s?(.*)$/i;

  /* Split at commas and "and", outside quotes and brackets. */
  function splitItems(s, andToo = true) {
    const parts = []; let depth = 0, quote = null, cur = '';
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (quote) { cur += c; if (c === '\\') cur += s[++i] || ''; else if (c === quote) quote = null; continue; }
      if (c === '"' || c === "'") { quote = c; cur += c; continue; }
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

  const TYPE_WORDS = { number: 'int', numbers: 'int', 'whole number': 'int', 'whole numbers': 'int', decimal: 'double', decimals: 'double', text: 'std::string', words: 'std::string', 'yes/no': 'bool', character: 'char', characters: 'char' };
  const CPP_TYPES = /^(?:const\s+)?(?:unsigned\s+)?(?:int|long|long long|short|double|float|bool|char|void|size_t|auto|std::string|string|String|byte|uint8_t|uint16_t|uint32_t|int8_t|int16_t|int32_t)(?:\s*[&*])?$/;
  const TYPE_WORD_RE = /^(whole numbers?|numbers?|decimals?|text|words|yes\/no|characters?|nothing|list of (?:whole numbers|numbers|decimals|text|words))\s+/i;

  /* A type written in a sentence -> C++ type. */
  function typeOf(word, x) {
    const w = String(word || '').trim();
    const low = w.toLowerCase();
    if (low === 'nothing') return 'void';
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
    if (/^millis\(\)$/.test(t)) return 'unsigned long';
    if (x.arduino && /^(?:LED_BUILTIN|A\d+|HIGH|LOW)$/.test(t)) return 'int';
    if (/^std::stod\(|\.toFloat\(\)$/.test(t)) return 'double';
    if (/^[A-Za-z_]\w*$/.test(t) && x.types[t]) return x.types[t];
    const ids = t.match(/[A-Za-z_]\w*/g) || [];
    if (ids.length && /[-+*/%]/.test(t) && ids.every(i => x.types[i] === 'int' || x.types[i] === 'double')) return ids.some(i => x.types[i] === 'double') || /\d\.\d/.test(t) ? 'double' : 'int';
    const noTemplates = t.replace(/([\w:])<[\w:<>,\s*&]*>(?=\s*[({]|::)/g, '$1');   // make_unique<Circle>(…) isn't a comparison
    if (/[<>=!]=|[<>]|&&|\|\|/.test(noTemplates) && !/<</.test(noTemplates)) return 'bool';
    return 'auto';
  }

  function cppExpr(src, x, inf) {
    let s = String(src || '').trim();
    if (!s) { inf.errs.push('Something is missing here: a value.'); return '0'; }
    const strs = [];
    let q = s.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)'/g, (m) => { strs.push(m); return ` ⟦${strs.length - 1}⟧ `; });
    if (/'/.test(q.replace(/\b\w'\w/g, ''))) inf.warns.push("In C++, text goes in double quotes (\"like this\"). Single quotes are for one character.");
    const OPD = String.raw`(?:⟦\d+⟧|-?\d+(?:\.\d+)?|[A-Za-z_]\w*(?:(?:\.|::|->)\w+)*(?:\([^()]*\)|\[[^\[\]]*\])*)`;
    const R = (p) => new RegExp(p.replace(/OPD/g, OPD), 'gi');
    q = q.replace(/\bself\s*\.\s*/g, 'this->');
    q = q.replace(/\bthe\b/gi, ' ');
    if (x.arduino) {
      q = q.replace(/\bbuilt-?in (?:light|led)\b/gi, 'LED_BUILTIN');
      q = q.replace(R(String.raw`\bpin (OPD) is (on|off|high|low)\b`), (m, p, v) => { note(inf, '`digitalRead` checks whether a pin is on (HIGH) or off (LOW).'); return `digitalRead(${p}) == ${/on|high/i.test(v) ? 'HIGH' : 'LOW'}`; });
      q = q.replace(R(String.raw`\b(?:analog )?(?:reading|level) (?:of|on) pin (OPD)`), (m, p) => { note(inf, '`analogRead` measures the voltage on a pin as a number from 0 to 1023.'); return `analogRead(${p})`; });
      q = q.replace(R(String.raw`\bpin (OPD)`), '$1');
      q = q.replace(/\b(?:time|milliseconds) since (?:the )?start\b/gi, () => { note(inf, '`millis()` is how many milliseconds have passed since the board started.'); return 'millis()'; });
    }
    q = q.replace(R(String.raw`\bfirst item (?:of|in) (OPD)`), x.arduino ? '$1[0]' : '$1.front()').replace(R(String.raw`\blast item (?:of|in) (OPD)`), x.arduino ? '$1[(sizeof($1) / sizeof($1[0])) - 1]' : '$1.back()');
    q = q.replace(R(String.raw`\bitem (OPD) (?:of|in) (OPD)`), '$2[$1]');
    q = q.replace(R(String.raw`\b(?:length|size) of (OPD)`), (m, a) => {
      if (!x.arduino) return `${a}.size()`;
      if (/^String$/.test(x.types[a] || '')) return `${a}.length()`;
      note(inf, 'Arduino lists are plain arrays: `sizeof(list) / sizeof(list[0])` works out how many items they hold.');
      return `(sizeof(${a}) / sizeof(${a}[0]))`;
    });
    q = q.replace(R(String.raw`\brandom (?:whole )?number (?:from|between) (OPD) (?:to|and) (OPD)`), (m, a, b) => {
      if (x.arduino) { note(inf, '`random(low, high)` on Arduino never reaches `high`, so 1 is added to include the top number.'); return `random(${a}, ${/^\d+$/.test(b) ? +b + 1 : b + ' + 1'})`; }
      x.needs.add('random'); note(inf, 'C++ has no one-word random function, so a small helper, `random_number`, is added at the top. It uses `<random>` and includes both ends.'); return `random_number(${a}, ${b})`;
    });
    q = q.replace(R(String.raw`(OPD) as (?:a )?(?:whole )?number\b`), (m, a) => { if (x.arduino) return `${a}.toInt()`; note(inf, '`std::stoi` turns text into a whole number (it stops with an error if the text isn\'t a number).'); return `std::stoi(${a})`; });
    q = q.replace(R(String.raw`(OPD) as (?:a )?decimal\b`), x.arduino ? '$1.toFloat()' : 'std::stod($1)').replace(R(String.raw`(OPD) as text\b`), x.arduino ? 'String($1)' : 'std::to_string($1)');
    q = q.replace(R(String.raw`(OPD) squared\b`), '($1 * $1)');
    const W = [
      [/\bis not (?:equal to|the same as)\b|\bisn't\b|\bis not\b/gi, ' != '], [/\bis at least\b|\bis (?:greater|more) than or equal to\b/gi, ' >= '], [/\bis at most\b|\bis (?:less|smaller) than or equal to\b/gi, ' <= '],
      [/\bis (?:greater|more|bigger|higher) than\b/gi, ' > '], [/\bis (?:less|smaller|lower|fewer) than\b/gi, ' < '], [/\bis (?:equal to|the same as)\b|\bequals\b|\bis\b/gi, ' == '],
      [/\bplus\b/gi, ' + '], [/\bminus\b/gi, ' - '], [/\btimes\b/gi, ' * '], [/\bdivided by\b/gi, ' / '], [/\bmod\b/gi, ' % '],
      [/\band\b/gi, ' && '], [/\bor\b/gi, ' || '], [/\bnot\b/gi, ' !'], [/\b(?:yes|true)\b/gi, 'true'], [/\b(?:no|false)\b/gi, 'false'],
    ];
    for (const [re, to] of W) q = q.replace(re, to);
    q = q.replace(/(?<![\w.:>⟦])([A-Za-z_]\w*)\b(?!\s*::)/g, (m, id, off) => {
      if (/^(true|false|std|random_number|random|text|auto|int|double|bool|char|return|nullptr|this|sizeof|String|HIGH|LOW|INPUT|OUTPUT|INPUT_PULLUP|LED_BUILTIN|A\d+|millis|digitalRead|analogRead|Serial|new|delete|static_cast)$/.test(id) || x.types[id] || x.fns.has(id) || x.classes.has(id) || x.known.has(id)) return id;
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
        note(inf, 'Text with {…} inside is joined with `+`. Starting with `String(…)` makes the joining work on Arduino. (A brace itself is written twice: {{ or }}.)');
        return parts.map((p, k) => (k === 0 ? `String(${p})` : p)).join(' + ');
      }
      x.needs.add('text');
      note(inf, 'Text with {…} inside is built by a small helper, `text(…)`, added at the top: it joins the pieces and the values into one std::string. (A brace itself is written twice: {{ or }}.)');
      return `text(${parts.join(', ')})`;
    });
    return q;
  }

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
    // first pass: names of tools and classes
    for (const l of lines) {
      const s = l.trim();
      let m;
      if ((m = s.match(/^define\s+(?:a\s+)?class\s+([A-Za-z_]\w*)/i))) x.classes.add(m[1]);
      else if ((m = s.match(/^define\s+([A-Za-z_]\w*)/i))) x.fns.add(m[1]);
      if (/^start (?:the serial monitor|talking to the computer)|Serial\.begin/i.test(s)) serialStarted = true;
      if ((m = s.match(/^(?:c\+\+|cpp|raw|above main|outside main|at the top)\s*:(.*)$/i))) {   // names made in raw C++
        for (const d of m[1].matchAll(/\b(?:class|struct)\s+([A-Za-z_]\w*)/g)) { x.classes.add(d[1]); x.known.add(d[1]); }
        for (const d of m[1].matchAll(/^\s*(?:(?:const|static|unsigned|constexpr|inline)\s+)*[A-Za-z_][\w:<>,]*[\s&*]+([A-Za-z_]\w*)\s*(?:=|;|\(|\[|\{)/g)) x.known.add(d[1]);
      }
    }
    const scopes = [new Set()];
    const isDeclared = (n) => scopes.some(sc => sc.has(n));
    const declare = (name, type, inf, value) => {
      if (isDeclared(name)) return `${name} = ${value};`;
      scopes[scopes.length - 1].add(name);
      x.types[name] = type;
      const T = fixText(type, x);
      if (T !== 'auto') note(inf, `C++ needs to know what kind of value ${code(name)} holds: ${code(T)}${{ int: ' (a whole number)', double: ' (a decimal number)', 'std::string': ' (text)', String: ' (text)', bool: ' (yes or no)', 'unsigned long': ' (a big whole number that is never negative)' }[T] || ''}. It can't change kind later.`);
      else note(inf, '`auto` lets C++ work out the kind of value from what is stored.');
      return `${T} ${name} = ${value};`;
    };
    const cur = () => stack[stack.length - 1];
    const inside = (kind) => stack.some(b => b.kind === kind);
    const closeBlock = () => {
      const b = stack.pop();
      scopes.pop();
      while (b.buf.length && b.buf[b.buf.length - 1].text === '') b.buf.pop();
      b.buf.push({ text: '    '.repeat(b.depth) + b.close, src: b.src });
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
      const open = (head, kind, extra = {}) => { const d = depthNow(); say(head + ' {'); stack.push({ ind, close: '}', kind, src: i, buf: out, depth: d, ...extra }); scopes.push(new Set()); };
      const trimmed = raw.trim();
      let m;
      // raw code is copied exactly, before any tidying of the sentence
      if ((m = trimmed.match(ABOVE))) {
        if (stack.length) inf.errs.push('"above main:" lines go at the left edge.');
        note(inf, 'C++ copied exactly as written, placed above `main` (outside every tool).');
        topOut.push({ text: m[1], src: i });
        return;
      }
      if ((m = trimmed.match(RAW))) { note(inf, 'Raw C++: copied exactly as written.'); return say(m[1]); }
      let s = trimmed.replace(/[.:]$/, '');
      const lead = s.match(FILLER);
      if (lead && lead[0].length < s.length) { note(inf, `Left out filler: "${lead[0].trim()}".`); s = s.slice(lead[0].length); }
      if ((m = s.match(/^(?:note|comment)\s*:\s*(.*)$/i))) return say('// ' + m[1]);
      const M = (re) => qmatch(s, re);   // like s.match, but sentence words inside quotes never count
      // --- program setup
      if ((m = M(/^(?:include|use the library)\s+(<[^>]+>|"[^"]+"|[\w./]+)$/i))) {
        const h = /^[<"]/.test(m[1]) ? m[1] : `<${m[1]}>`;
        note(inf, `${code('#include ' + h)} brings in a library${/^"/.test(h) ? ' (a file of this project)' : ''}, so the program can use what it defines.`);
        if (!includes.some(e => e.h === h)) includes.push({ h, src: i });
        return;
      }
      if (/^use (?:namespace std|the standard names(?: directly)?|std names directly)$/i.test(s)) { usingStd = i; note(inf, '`using namespace std;` lets the code write `cout` instead of `std::cout`. Fine in small programs; big ones avoid it so names don\'t clash.'); return; }
      // --- classes
      if ((m = M(/^define\s+(?:a\s+)?class\s+([A-Za-z_]\w*)(?:\s+based on\s+([A-Za-z_][\w:]*))?$/i))) {
        if (stack.length) inf.errs.push('Classes must be defined at the left edge, not inside another block.');
        out = topOut;
        x.classes.add(m[1]); x.known.add(m[1]);
        note(inf, `A class is a blueprint for objects. Each object made from ${code(m[1])} keeps its own values (its fields) and can use the tools defined inside it.` + (m[2] ? ` It builds on ${code(m[2])} (\`public\` inheritance: everything public in ${m[2]} stays public).` : '') + ' Classes are placed above `main`.');
        topOut.push({ text: `class ${m[1]}${m[2] ? ' : public ' + m[2] : ''} {`, src: i });
        topOut.push({ text: 'public:', src: i });
        stack.push({ ind, close: '};', kind: 'class', src: i, buf: topOut, depth: 0, cls: m[1] });
        scopes.push(new Set());
        return;
      }
      if (cur() && cur().kind === 'class') {
        if ((m = M(/^field\s+([A-Za-z_]\w*)\s*:\s*(.+?)(?:\s+(?:=|starting (?:at|as))\s+(.+))?$/i)) || (m = M(/^has\s+(?:an?\s+)?(.+?)\s+([A-Za-z_]\w*)(?:\s+(?:starting (?:at|as)|=)\s+(.+))?$/i))) {
          const [name, typeWord, init] = /^field/i.test(s) ? [m[1], m[2], m[3]] : [m[2], m[1], m[3]];
          const t = typeOf(typeWord, x);
          if (!t) { inf.errs.push(`I don't know the type "${typeWord}". Use whole number, decimal, text, yes/no, list of …, or a C++ type.`); return; }
          x.types[name] = t; x.known.add(name);
          note(inf, `Every ${cur().cls} object has its own ${code(name)} (${code(t)}).` + (init ? ` It starts as ${code(init.trim())}.` : ''));
          return say(`${t} ${name}${init ? ' = ' + E(init, inf) : ''};`);
        }
        if (/^(?:the rest is|from here on,?) (private|public)$/i.test(s) || /^(private|public) parts?$/i.test(s)) {
          const which = (s.match(/private|public/i) || ['public'])[0].toLowerCase();
          note(inf, which === 'private' ? '`private:` members can only be used by the class\'s own tools. It protects values from being changed by accident.' : '`public:` members can be used from anywhere.');
          return out.push({ text: '    '.repeat(depth - 1) + which + ':', src: i });
        }
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
        const ps = m[2] ? splitItems(m[2]).map(p => param(p, x)) : [];
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
        return open('void loop()', 'fn');
      }
      if (A && !stack.length && !/^(?:(?:set|let)\s+(?!pin\b|the (?:brightness|level|power)\b)[\w\s/:<>&*]+?\s+(?:to|be)\b|constant\s|(?:create|make)\s+(?:an?\s+)?(?:empty\s+)?list\b|make\s+(?:a\s+)?new\b)/i.test(s)) {
        inf.errs.push('In a sketch, steps go inside "when the board starts" (once) or "over and over" (forever). Only settings like "set led to 13" go at the left edge.');
        return;
      }
      if ((m = M(/^(?:give back|return)\b\s*(.*)$/i))) { if (!inside('fn')) inf.errs.push('"give back" only works inside a tool (a define block).'); return say(m[1] ? `return ${E(m[1], inf)};` : 'return;'); }
      if ((m = M(/^(?:otherwise if|else if)\s+(.+)$/i))) { out.push({ text: '    '.repeat(depth - 1) + `} else if (${E(m[1], inf)}) {`, src: i }); return; }
      if (/^(?:otherwise|else)$/i.test(s)) { out.push({ text: '    '.repeat(depth - 1) + '} else {', src: i }); return; }
      if ((m = M(/^if\s+(.+)$/i))) return open(`if (${E(m[1], inf)})`, 'if');
      if (/^(?:repeat forever|forever|keep repeating)$/i.test(s)) { note(inf, '`while (true)` repeats forever; "stop the loop" (break) gets out.'); return open('while (true)', 'loop'); }
      if ((m = M(/^repeat\s+(.+?)\s+times?(?:\s+counting with\s+([A-Za-z_]\w*))?$/i))) { const v = m[2] || 'i'; x.types[v] = 'int'; note(inf, `\`for (int ${v} = 0; ${v} < N; ${v}++)\` counts ${v} from 0 up to one less than N.`); open(`for (int ${v} = 0; ${v} < ${E(m[1], inf)}; ${v}++)`, 'loop'); scopes[scopes.length - 1].add(v); return; }
      if ((m = M(/^count\s+([A-Za-z_]\w*)\s+from\s+(.+?)\s+to\s+(.+)$/i))) { x.types[m[1]] = 'int'; const down = /^\d+$/.test(m[2].trim()) && /^\d+$/.test(m[3].trim()) && +m[2] > +m[3]; note(inf, `Counts ${down ? 'down' : 'up'} and includes ${m[3].trim()} (the ${down ? '>=' : '<='}).`); open(`for (int ${m[1]} = ${E(m[2], inf)}; ${m[1]} ${down ? '>=' : '<='} ${E(m[3], inf)}; ${m[1]}${down ? '--' : '++'})`, 'loop'); scopes[scopes.length - 1].add(m[1]); return; }
      if ((m = M(/^for each\s+([A-Za-z_]\w*)\s+in\s+(.+)$/i))) { const list = E(m[2], inf); x.types[m[1]] = (x.types[list] || '').replace(/^std::vector<(.+)>$/, '$1').replace(/\[\]$/, '') || 'auto'; note(inf, '`for (const auto& item : list)` takes each item in turn. `const auto&` reads it without copying.'); open(`for (const auto& ${m[1]} : ${list})`, 'loop'); scopes[scopes.length - 1].add(m[1]); return; }
      if ((m = M(/^(?:while|as long as)\s+(.+)$/i))) return open(`while (${E(m[1], inf)})`, 'loop');
      if (/^stop the loop$/i.test(s)) return say('break;');
      if (/^skip to next$/i.test(s)) return say('continue;');
      // --- Arduino: pins, time, sound, serial monitor
      if (A) {
        const pin = (p) => (/^(?:the )?built-?in (?:light|led)$/i.test(p.trim()) ? 'LED_BUILTIN' : E(p.replace(/^pin\s+/i, ''), inf));
        if ((m = M(/^(?:make|set)\s+(?:pin\s+)?(.+?)\s+(?:an?|as(?:\s+an?)?)\s+(output|input)(\s+with (?:a )?pull-?up)?$/i))) {
          const mode = /output/i.test(m[2]) ? 'OUTPUT' : m[3] ? 'INPUT_PULLUP' : 'INPUT';
          note(inf, `\`pinMode\` sets a pin up as ${mode === 'OUTPUT' ? 'an output (the board sends power out, e.g. to an LED)' : mode === 'INPUT_PULLUP' ? 'an input with the built-in pull-up: it reads HIGH until a button connects it to ground' : 'an input (the board reads it, e.g. a button)'}.`);
          return say(`pinMode(${pin(m[1])}, ${mode});`);
        }
        if ((m = M(/^turn\s+(on|off)\s+(.+)$/i)) || (m = M(/^turn\s+(.+?)\s+(on|off)$/i))) {
          const [on, p] = /^(on|off)$/i.test(m[1]) ? [m[1], m[2]] : [m[2], m[1]];
          note(inf, '`digitalWrite` turns a pin on (HIGH, 5 or 3.3 volts) or off (LOW, 0 volts).');
          return say(`digitalWrite(${pin(p)}, ${/on/i.test(on) ? 'HIGH' : 'LOW'});`);
        }
        if ((m = M(/^set\s+pin\s+(.+?)\s+to\s+(high|low|on|off)$/i))) return say(`digitalWrite(${pin(m[1])}, ${/high|on/i.test(m[2]) ? 'HIGH' : 'LOW'});`);
        if ((m = M(/^(?:set the (?:brightness|level|power) of|dim)\s+(.+?)\s+to\s+(.+)$/i)) || (m = M(/^write\s+(.+?)\s+to\s+pin\s+(.+)$/i))) {
          const [p, v] = /^write/i.test(s) ? [m[2], m[1]] : [m[1], m[2]];
          note(inf, '`analogWrite` sets a level from 0 (off) to 255 (full), by switching the pin on and off very fast (PWM). Only pins marked ~ can do it.');
          return say(`analogWrite(${pin(p)}, ${E(v, inf)});`);
        }
        if ((m = M(/^read\s+(analog\s+)?(?:pin\s+)?(.+?)\s+and store (?:it )?in\s+([A-Za-z_]\w*)$/i))) {
          const analog = !!m[1] || /^A\d+$/.test(m[2].trim());
          note(inf, analog ? '`analogRead` measures the voltage on a pin as a number from 0 to 1023.' : '`digitalRead` reads a pin: HIGH (on) or LOW (off).');
          return say(declare(m[3], 'int', inf, `${analog ? 'analogRead' : 'digitalRead'}(${pin(m[2])})`));
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
      }
      if ((m = M(/^show\s+(.+?)(\s+on the same line)?$/i))) {
        const joined = splitPhrase(m[1], /\s+followed by\s+/i);
        const pieces = joined.length > 1 ? joined.map(v => E(v, inf)) : splitItems(m[1]).map(v => E(v, inf));
        const gap = joined.length > 1 ? '' : ' ';
        if (A) {
          if (!serialStarted) inf.warns.push('Start the serial monitor first ("start the serial monitor at 9600", in "when the board starts"), or nothing will show.');
          note(inf, '`Serial.println` sends a line to the computer\'s serial monitor.' + (pieces.length > 1 ? ' `Serial.print` sends a piece without ending the line.' : ''));
          const calls = [];
          pieces.forEach((p, k) => { if (k && gap) calls.push('Serial.print(" ");'); calls.push(`Serial.${k === pieces.length - 1 && !m[2] ? 'println' : 'print'}(${p});`); });
          return say(calls.join(' '));
        }
        note(inf, '`std::cout <<` writes to the terminal' + (pieces.length > 1 ? (gap ? ', with a space between the pieces' : ', one piece straight after another') : '') + (m[2] ? '.' : '; `std::endl` ends the line.'));
        return say('std::cout << ' + pieces.join(gap ? ' << " " << ' : ' << ') + (m[2] ? ' << " ";' : ' << std::endl;'));
      }
      if ((m = M(/^ask(?:\s+for\s+(?:an?\s+)?(whole number|number|decimal))?\s+(.+?)\s+and store (?:it )?in\s+([A-Za-z_]\w*)$/i))) {
        const kind = (m[1] || '').toLowerCase();
        const type = /decimal/.test(kind) ? 'double' : /number/.test(kind) ? 'int' : 'std::string';
        const decl = isDeclared(m[3]) ? '' : `${type} ${m[3]}; `;
        scopes[scopes.length - 1].add(m[3]); x.types[m[3]] = type;
        say(`${decl}std::cout << ${E(m[2], inf)};`);
        note(inf, type === 'std::string' ? '`std::getline` reads a whole line of typed text.' : '`std::cin >>` reads a number typed by the person.');
        return say(type === 'std::string' ? `std::getline(std::cin, ${m[3]});` : `std::cin >> ${m[3]};`);
      }
      if ((m = M(/^(?:create|make)\s+(?:an?\s+)?(?:empty\s+)?list(?:\s+of\s+(numbers|whole numbers|decimals|text|words))?\s+(?:called\s+)?([A-Za-z_]\w*)(?:\s+with\s+(.+))?$/i))) {
        const items = m[3] ? splitItems(m[3]).map(v => E(v, inf)) : [];
        const t0 = m[1] ? TYPE_WORDS[m[1].toLowerCase()] : items.length ? exprType(items[0], x) : null;
        if (!t0) { inf.errs.push('C++ needs to know what the list will hold. Say "create list of numbers …" or "list of text …".'); return; }
        const t = fixText(t0 === 'auto' ? 'int' : t0, x);
        scopes[scopes.length - 1].add(m[2]);
        if (A) {
          if (!items.length) { inf.errs.push('An Arduino list has a fixed size, so give it its items: "create list of numbers called pins with 2, 3, 4".'); return; }
          x.types[m[2]] = t + '[]';
          note(inf, `A list on Arduino is a plain array: a fixed number of ${code(t)} values. It can't grow, which saves the board's small memory.`);
          return say(`${t} ${m[2]}[] = {${items.join(', ')}};`);
        }
        const type = `std::vector<${t}>`;
        x.needs.add('vector');
        x.types[m[2]] = type;
        note(inf, `A list in C++ is a \`std::vector\`, and every item has the same kind: ${code(t)}.`);
        return say(`${type} ${m[2]} = {${items.join(', ')}};`);
      }
      if ((m = M(/^add\s+(.+?)\s+to\s+([A-Za-z_]\w*)$/i))) {
        if (/^std::vector/.test(x.types[m[2]] || '')) { note(inf, '`push_back` adds to the end of a vector.'); return say(`${m[2]}.push_back(${E(m[1], inf)});`); }
        if (/\[\]$/.test(x.types[m[2]] || '')) { inf.errs.push('Arduino lists have a fixed size, so nothing can be added. Make the list with all its items instead.'); return; }
        return say(`${m[2]} += ${E(m[1], inf)};`);
      }
      if ((m = M(/^(increase|decrease)\s+(.+?)(?:\s+by\s+(.+))?$/i))) {
        const up = /^increase$/i.test(m[1]);
        if (m[3]) return say(`${E(m[2], inf)} ${up ? '+' : '-'}= ${E(m[3], inf)};`);
        note(inf, `No amount given, so it goes ${up ? 'up' : 'down'} by 1: \`${up ? '++' : '--'}\` ${up ? 'adds' : 'takes away'} 1.`);
        return say(`${E(m[2], inf)}${up ? '++' : '--'};`);
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
        if (!x.fns.has(m[1]) && !/[.:>]/.test(m[1]) && !x.known.has(m[1])) inf.errs.push(`There's no tool called ${code(m[1])}. Make one with "define ${m[1]} using …".`);
        return say(m[3] ? declare(m[3], 'auto', inf, call) : call + ';');
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
    }
    const auto = new Set(all.map(o => o.text.slice(9)));
    for (const inc of includes) if (!auto.has(inc.h)) hdr(`#include ${inc.h}`, null, inc.src);
    if (usingStd != null) hdr('using namespace std;', null, usingStd);
    if (all.length) hdr('', null);
    if (x.needs.has('random')) {
      ['int random_number(int low, int high) {', '    static std::mt19937 generator(std::random_device{}());', '    return std::uniform_int_distribution<int>(low, high)(generator);', '}', ''].forEach(t => hdr(t, 'A helper for "random number from … to …": picks a whole number between low and high, both included.'));
    }
    if (x.needs.has('text')) {
      ['template <typename... Parts>', 'std::string text(const Parts&... parts) {', '    std::ostringstream out;', '    (out << ... << parts);', '    return out.str();', '}', ''].forEach(t => hdr(t, 'A helper for text with {…} in it: joins the pieces and values into one std::string.'));
    }
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
    for (const sec of project.sections) results[sec.id] = compileCpp(sec, x);
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
    T('Show & ask', 'show ‹value›', 'std::cout << value << std::endl;', 'Join several things with "and" (a space between) or "followed by" (no space).'),
    T('Show & ask', 'ask for a number "‹question›" and store in ‹name›', 'std::cin >> name;', 'Or "ask … and store in …" for text.'),
    T('Decisions', 'if ‹condition›', 'if (condition) {', '', ['program', 'sketch']),
    T('Decisions', 'otherwise', '} else {', '', ['program', 'sketch']),
    T('Loops', 'repeat ‹number› times', 'for (int i = 0; i < number; i++) {', '', ['program', 'sketch']),
    T('Loops', 'count ‹i› from ‹1› to ‹10›', 'for (int i = 1; i <= 10; i++) {', '', ['program', 'sketch']),
    T('Loops', 'for each ‹item› in ‹list›', 'for (const auto& item : list) {', '', ['program', 'sketch']),
    T('Loops', 'while ‹condition›', 'while (condition) {', '', ['program', 'sketch']),
    T('Loops', 'repeat forever', 'while (true) {', 'Pair with "stop the loop".'),
    T('Lists', 'create list of ‹numbers› called ‹name› with ‹1, 2, 3›', 'std::vector<int> name = {1, 2, 3};', 'Also "list of text", "list of decimals".', ['program', 'sketch']),
    T('Lists', 'add ‹value› to ‹list›', 'list.push_back(value);', ''),
    T('Tools', 'define ‹name› using ‹inputs›', 'auto name(auto inputs) {', 'Tools go above main automatically.', ['program', 'sketch']),
    T('Tools', 'define ‹name› using ‹decimal w›, ‹decimal h› giving back ‹decimal›', 'double name(double w, double h) {', 'Name the kinds: whole number, decimal, text, yes/no, nothing.', ['program', 'sketch']),
    T('Tools', 'give back ‹value›', 'return value;', '', ['program', 'sketch']),
    T('Tools', 'run ‹tool› with ‹inputs› and store in ‹name›', 'auto name = tool(inputs);', '', ['program', 'sketch']),
    T('Classes', 'define class ‹Name›', 'class Name { public: … };', 'A blueprint for objects. Indent its fields and tools under it.', ['program', 'sketch']),
    T('Classes', 'field ‹name›: ‹text›', 'std::string name;', 'Inside a class. Also "has whole number count starting at 0".', ['program', 'sketch']),
    T('Classes', 'when made using ‹text name›', 'Name(std::string name) {', 'Inside a class: runs when a new object is made. Use "set self.name to name".', ['program', 'sketch']),
    T('Classes', 'make a new ‹Class› with ‹inputs› and store in ‹name›', 'Class name(inputs);', 'Creates an object from a class.', ['program', 'sketch']),
    T('Program', 'include ‹cmath›', '#include <cmath>', 'Brings in a library.', ['program', 'sketch']),
    T('Program', 'above main: ‹C++ code›', 'code (outside main)', 'C++ copied exactly, outside main.'),
    T('Other', 'c++: ‹code›', 'code', 'Write C++ directly.', ['program', 'sketch']),
    T('Board', 'when the board starts', 'void setup() {', 'Runs once, when the board powers on.', ['sketch']),
    T('Board', 'over and over', 'void loop() {', 'Runs again and again, forever.', ['sketch']),
    T('Pins', 'make pin ‹13› an output', 'pinMode(13, OUTPUT);', 'Also "an input", "an input with pull-up".', ['sketch']),
    T('Pins', 'turn pin ‹13› on', 'digitalWrite(13, HIGH);', 'And "turn pin 13 off". "the built-in light" is LED_BUILTIN.', ['sketch']),
    T('Pins', 'set the brightness of pin ‹9› to ‹128›', 'analogWrite(9, 128);', '0 to 255, on pins marked ~.', ['sketch']),
    T('Pins', 'read pin ‹2› and store in ‹pressed›', 'int pressed = digitalRead(2);', 'Or "read analog pin A0 …" for 0 to 1023.', ['sketch']),
    T('Time', 'wait ‹500› milliseconds', 'delay(500);', 'Or "wait 2 seconds".', ['sketch']),
    T('Serial', 'start the serial monitor at ‹9600›', 'Serial.begin(9600);', 'Put it in "when the board starts".', ['sketch']),
    T('Serial', 'show ‹value›', 'Serial.println(value);', 'Shows in the serial monitor.', ['sketch']),
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
  const WORDS = [['a is b', 'a == b'], ['a is not b', 'a != b'], ['a and b', 'a && b'], ['not a', '!a'], ['length of x', 'x.size()'], ['item 0 of x', 'x[0]'], ['random number from 1 to 6', 'random_number(1, 6)'], ['x as number', 'std::stoi(x)'], ['x as text', 'std::to_string(x)'], ['"Hi {name}"', 'text("Hi ", name)'], ['self.name', 'this->name'], ['a followed by b', 'a << b']];
  const ARDUINO_WORDS = [['pin 2 is on', 'digitalRead(2) == HIGH'], ['reading of pin A0', 'analogRead(A0)'], ['time since start', 'millis()'], ['the built-in light', 'LED_BUILTIN'], ['random number from 1 to 6', 'random(1, 7)'], ['x as number', 'x.toInt()'], ['x as text', 'String(x)'], ['"Hi {name}"', 'String("Hi ") + name']];
  const OPENS_BLOCK = /^\s*(?:if |otherwise|else|repeat |count |for each |while |define |as long as |forever|keep repeating|when (?:made|created|built|the board)|over and over|again and again|at the start)/i;

  const api = { compileCppProject, TEMPLATES, GUIDE, ARDUINO_GUIDE, WORDS, ARDUINO_WORDS, OPENS_BLOCK, typeOf: (w, arduino) => typeOf(w, { classes: new Set(), needs: new Set(), arduino }) };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.IntuiCpp = api;
})(typeof window !== 'undefined' ? window : globalThis);

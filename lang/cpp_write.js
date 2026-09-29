/* IntuiCode — C++ language pack: sentences -> C++.
 *
 * Same sentences as Python where they make sense. C++ needs a type for every
 * value, so the translator works types out from the values (text -> std::string,
 * whole numbers -> int, decimals -> double, yes/no -> bool) and explains the choice.
 * Tools use `auto` for their inputs and result (C++20), so sentences don't need types.
 *
 * compileCppProject(project) returns the same shape as the other packs.
 */
(function (root) {
  'use strict';

  const code = (s) => '`' + s + '`';
  const note = (inf, s) => { if (!inf.notes.includes(s)) inf.notes.push(s); };
  const FILLER = /^(?:(?:please|now|next|then|and then|also|just|i want to|i'd like to|let's|let us|go ahead and)\s*,?\s+)+/i;

  function splitItems(s) {
    const parts = []; let depth = 0, quote = null, cur = '';
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (quote) { cur += c; if (c === '\\') cur += s[++i] || ''; else if (c === quote) quote = null; continue; }
      if (c === '"' || c === "'") { quote = c; cur += c; continue; }
      if ('([{'.includes(c)) depth++;
      if (')]}'.includes(c)) depth--;
      if (depth === 0 && c === ',') { parts.push(cur); cur = ''; continue; }
      if (depth === 0 && /^\s+and\s+/i.test(s.slice(i)) && /\s/.test(c)) { const m = s.slice(i).match(/^\s+and\s+/i); parts.push(cur); cur = ''; i += m[0].length - 1; continue; }
      cur += c;
    }
    parts.push(cur);
    return parts.map(p => p.trim()).filter(Boolean);
  }

  const TYPE_WORDS = { number: 'int', numbers: 'int', 'whole numbers': 'int', decimal: 'double', decimals: 'double', text: 'std::string', words: 'std::string', 'yes/no': 'bool' };

  function exprType(e, x) {
    const t = e.trim();
    if (/^"/.test(t) || /^text\(/.test(t) || /^std::(to_string|string)/.test(t)) return 'std::string';
    if (/^-?\d+$/.test(t)) return 'int';
    if (/^-?\d*\.\d+$/.test(t)) return 'double';
    if (/^(true|false)$/.test(t)) return 'bool';
    if (/^std::sto(i|l)\(|\.size\(\)$|^random_number\(/.test(t)) return 'int';
    if (/^std::stod\(/.test(t)) return 'double';
    if (/^[A-Za-z_]\w*$/.test(t) && x.types[t]) return x.types[t];
    const ids = t.match(/[A-Za-z_]\w*/g) || [];
    if (ids.length && /[-+*/%]/.test(t) && ids.every(i => x.types[i] === 'int' || x.types[i] === 'double')) return ids.some(i => x.types[i] === 'double') || /\d\.\d/.test(t) ? 'double' : 'int';
    if (/[<>=!]=|[<>]|&&|\|\|/.test(t) && !/<</.test(t)) return 'bool';
    return 'auto';
  }

  function cppExpr(src, x, inf) {
    let s = String(src || '').trim();
    if (!s) { inf.errs.push('Something is missing here: a value.'); return '0'; }
    const strs = [];
    let q = s.replace(/"(?:[^"\\]|\\.)*"/g, (m) => { strs.push(m); return ` ⟦${strs.length - 1}⟧ `; });
    if (/'/.test(q.replace(/\b\w'\w/g, ''))) inf.warns.push("In C++, text goes in double quotes (\"like this\"). Single quotes are for one character.");
    const OPD = String.raw`(?:⟦\d+⟧|-?\d+(?:\.\d+)?|[A-Za-z_]\w*(?:(?:\.|::)\w+)*(?:\([^()]*\)|\[[^\[\]]*\])*)`;
    const R = (p) => new RegExp(p.replace(/OPD/g, OPD), 'gi');
    q = q.replace(/\bthe\b/gi, ' ');
    q = q.replace(R(String.raw`\bfirst item (?:of|in) (OPD)`), '$1.front()').replace(R(String.raw`\blast item (?:of|in) (OPD)`), '$1.back()');
    q = q.replace(R(String.raw`\bitem (OPD) (?:of|in) (OPD)`), '$2[$1]');
    q = q.replace(R(String.raw`\b(?:length|size) of (OPD)`), '$1.size()');
    q = q.replace(R(String.raw`\brandom (?:whole )?number (?:from|between) (OPD) (?:to|and) (OPD)`), (m, a, b) => { x.needs.add('random'); note(inf, 'C++ has no one-word random function, so a small helper, `random_number`, is added at the top. It uses `<random>` and includes both ends.'); return `random_number(${a}, ${b})`; });
    q = q.replace(R(String.raw`(OPD) as (?:a )?(?:whole )?number\b`), (m, a) => { note(inf, '`std::stoi` turns text into a whole number (it stops with an error if the text isn\'t a number).'); return `std::stoi(${a})`; });
    q = q.replace(R(String.raw`(OPD) as (?:a )?decimal\b`), 'std::stod($1)').replace(R(String.raw`(OPD) as text\b`), 'std::to_string($1)');
    q = q.replace(R(String.raw`(OPD) squared\b`), '($1 * $1)');
    const W = [
      [/\bis not (?:equal to|the same as)\b|\bisn't\b|\bis not\b/gi, ' != '], [/\bis at least\b|\bis (?:greater|more) than or equal to\b/gi, ' >= '], [/\bis at most\b|\bis (?:less|smaller) than or equal to\b/gi, ' <= '],
      [/\bis (?:greater|more|bigger|higher) than\b/gi, ' > '], [/\bis (?:less|smaller|lower|fewer) than\b/gi, ' < '], [/\bis (?:equal to|the same as)\b|\bequals\b|\bis\b/gi, ' == '],
      [/\bplus\b/gi, ' + '], [/\bminus\b/gi, ' - '], [/\btimes\b/gi, ' * '], [/\bdivided by\b/gi, ' / '], [/\bmod\b/gi, ' % '],
      [/\band\b/gi, ' && '], [/\bor\b/gi, ' || '], [/\bnot\b/gi, ' !'], [/\b(?:yes|true)\b/gi, 'true'], [/\b(?:no|false)\b/gi, 'false'],
    ];
    for (const [re, to] of W) q = q.replace(re, to);
    q = q.replace(/(?<![\w.:⟦])([A-Za-z_]\w*)\b(?!\s*::)/g, (m, id) => {
      if (/^(true|false|std|random_number|text|auto|int|double|bool|return|nullptr)$/.test(id) || x.types[id] || x.fns.has(id)) return id;
      if (/^\d/.test(id)) return id;
      inf.warns.push(`${code(id)} hasn't been set anywhere yet.`);
      return id;
    });
    q = q.replace(/\s+/g, ' ').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')').replace(/\s+,/g, ',').replace(/!\s+/g, '!').trim();
    q = q.replace(/⟦(\d+)⟧/g, (m, i) => {
      const str = strs[+i];
      if (/\{[^{}]+\}/.test(str)) {
        x.needs.add('text');
        note(inf, 'Text with {…} inside is built by a small helper, `text(…)`, added at the top: it joins the pieces and the values into one std::string.');
        const parts = [];
        let last = 1;
        const body = str.slice(1, -1);
        for (const mm of body.matchAll(/\{([^{}]+)\}/g)) {
          if (mm.index > last - 1) parts.push('"' + body.slice(last - 1, mm.index) + '"');
          parts.push(cppExpr(mm[1], x, inf));
          last = mm.index + mm[0].length + 1;
        }
        if (last - 1 < body.length) parts.push('"' + body.slice(last - 1) + '"');
        return `text(${parts.filter(p => p !== '""').join(', ')})`;
      }
      return str;
    });
    return q;
  }

  function compileCpp(sec, x) {
    const lines = sec.text.split('\n');
    const info = lines.map((_, i) => ({ line: i, py: [], notes: [], warns: [], errs: [] }));
    const fnsOut = [], mainOut = [];
    let out = mainOut;
    const stack = []; // {ind, close, kind, buf}
    const E = (t, inf) => cppExpr(t, x, inf);
    // first pass: tool names
    for (const l of lines) { const m = l.trim().match(/^define\s+([A-Za-z_]\w*)/i); if (m) x.fns.add(m[1]); }
    const declared = new Set();
    const declare = (name, type, inf, value) => {
      if (declared.has(name)) return `${name} = ${value};`;
      declared.add(name);
      x.types[name] = type;
      if (type !== 'auto') note(inf, `C++ needs to know what kind of value ${code(name)} holds: ${code(type)}${{ int: ' (a whole number)', double: ' (a decimal number)', 'std::string': ' (text)', bool: ' (yes or no)' }[type] || ''}. It can't change kind later.`);
      else note(inf, '`auto` lets C++ work out the kind of value from what is stored.');
      return `${type} ${name} = ${value};`;
    };
    lines.forEach((raw, i) => {
      const inf = info[i];
      if (!raw.trim()) { out.push({ text: '', src: i }); return; }
      const ind = raw.match(/^ */)[0].length;
      while (stack.length && ind <= stack[stack.length - 1].ind) {
        const b = stack[stack.length - 1];
        if (/^\s*(otherwise|else)\b/i.test(raw) && ind === b.ind && b.kind === 'if') break;
        stack.pop();
        while (b.buf.length && b.buf[b.buf.length - 1].text === '') b.buf.pop();
        b.buf.push({ text: '    '.repeat(b.depth) + b.close, src: b.src });
        if (!stack.length) out = mainOut;
      }
      const depth = stack.length + (out === mainOut ? 1 : 0);
      const pad = '    '.repeat(depth);
      let s = raw.trim().replace(/[.:]$/, '');
      const lead = s.match(FILLER);
      if (lead && lead[0].length < s.length) { note(inf, `Left out filler: "${lead[0].trim()}".`); s = s.slice(lead[0].length); }
      const say = (t) => out.push({ text: pad + t, src: i });
      const open = (head, kind) => { say(head + ' {'); stack.push({ ind, close: '}', kind, src: i, buf: out, depth }); };
      let m;
      if ((m = s.match(/^(?:note|comment)\s*:\s*(.*)$/i))) return say('// ' + m[1]);
      if ((m = s.match(/^(?:c\+\+|cpp|raw)\s*:\s?(.*)$/i))) { note(inf, 'Raw C++: copied exactly as written.'); return say(m[1]); }
      if ((m = s.match(/^define\s+([A-Za-z_]\w*)(?:\s+using\s+(.+))?$/i))) {
        if (stack.length) inf.errs.push('Tools must be defined at the left edge, not inside another block.');
        out = fnsOut;
        const params = m[2] ? splitItems(m[2]) : [];
        params.forEach(p => { x.types[p] = 'auto'; });
        note(inf, `A tool (a function). \`auto\` lets C++ work out the kinds of its inputs and result from how it is used. Tools are placed above \`main\`, because C++ must see them before they are used.`);
        out.push({ text: `auto ${m[1]}(${params.map(p => 'auto ' + p).join(', ')}) {`, src: i });
        stack.push({ ind, close: '}', kind: 'fn', src: i, buf: out, depth: 0 });
        return;
      }
      if ((m = s.match(/^(?:give back|return)\b\s*(.*)$/i))) { if (!stack.some(b => b.kind === 'fn')) inf.errs.push('"give back" only works inside a tool (a define block).'); return say(m[1] ? `return ${E(m[1], inf)};` : 'return;'); }
      if ((m = s.match(/^(?:otherwise if|else if)\s+(.+)$/i))) { out.push({ text: '    '.repeat(depth - 1) + `} else if (${E(m[1], inf)}) {`, src: i }); return; }
      if (/^(?:otherwise|else)$/i.test(s)) { out.push({ text: '    '.repeat(depth - 1) + '} else {', src: i }); return; }
      if ((m = s.match(/^if\s+(.+)$/i))) return open(`if (${E(m[1], inf)})`, 'if');
      if (/^(?:repeat forever|forever|keep repeating)$/i.test(s)) { note(inf, '`while (true)` repeats forever; "stop the loop" (break) gets out.'); return open('while (true)', 'loop'); }
      if ((m = s.match(/^repeat\s+(.+?)\s+times?(?:\s+counting with\s+([A-Za-z_]\w*))?$/i))) { const v = m[2] || 'i'; x.types[v] = 'int'; note(inf, `\`for (int ${v} = 0; ${v} < N; ${v}++)\` counts ${v} from 0 up to one less than N.`); return open(`for (int ${v} = 0; ${v} < ${E(m[1], inf)}; ${v}++)`, 'loop'); }
      if ((m = s.match(/^count\s+([A-Za-z_]\w*)\s+from\s+(.+?)\s+to\s+(.+)$/i))) { x.types[m[1]] = 'int'; const down = /^\d+$/.test(m[2].trim()) && /^\d+$/.test(m[3].trim()) && +m[2] > +m[3]; note(inf, `Counts ${down ? 'down' : 'up'} and includes ${m[3].trim()} (the ${down ? '>=' : '<='}).`); return open(`for (int ${m[1]} = ${E(m[2], inf)}; ${m[1]} ${down ? '>=' : '<='} ${E(m[3], inf)}; ${m[1]}${down ? '--' : '++'})`, 'loop'); }
      if ((m = s.match(/^for each\s+([A-Za-z_]\w*)\s+in\s+(.+)$/i))) { const list = E(m[2], inf); x.types[m[1]] = (x.types[list] || '').replace(/^std::vector<(.+)>$/, '$1') || 'auto'; note(inf, '`for (const auto& item : list)` takes each item in turn. `const auto&` reads it without copying.'); return open(`for (const auto& ${m[1]} : ${list})`, 'loop'); }
      if ((m = s.match(/^(?:while|as long as)\s+(.+)$/i))) return open(`while (${E(m[1], inf)})`, 'loop');
      if (/^stop the loop$/i.test(s)) return say('break;');
      if (/^skip to next$/i.test(s)) return say('continue;');
      if ((m = s.match(/^show\s+(.+?)(\s+on the same line)?$/i))) {
        const items = splitItems(m[1]).map(v => E(v, inf));
        note(inf, '`std::cout <<` writes to the terminal' + (items.length > 1 ? ', with a space between the pieces' : '') + (m[2] ? '.' : '; `std::endl` ends the line.'));
        return say('std::cout << ' + items.join(' << " " << ') + (m[2] ? ' << " ";' : ' << std::endl;'));
      }
      if ((m = s.match(/^ask(?:\s+for\s+(?:an?\s+)?(whole number|number|decimal))?\s+(.+?)\s+and store (?:it )?in\s+([A-Za-z_]\w*)$/i))) {
        const kind = (m[1] || '').toLowerCase();
        const type = /decimal/.test(kind) ? 'double' : /number/.test(kind) ? 'int' : 'std::string';
        const decl = declared.has(m[3]) ? '' : `${type} ${m[3]}; `;
        declared.add(m[3]); x.types[m[3]] = type;
        say(`${decl}std::cout << ${E(m[2], inf)};`);
        note(inf, type === 'std::string' ? '`std::getline` reads a whole line of typed text.' : '`std::cin >>` reads a number typed by the person.');
        return say(type === 'std::string' ? `std::getline(std::cin, ${m[3]});` : `std::cin >> ${m[3]};`);
      }
      if ((m = s.match(/^(?:create|make)\s+(?:an?\s+)?(?:empty\s+)?list(?:\s+of\s+(numbers|whole numbers|decimals|text|words))?\s+(?:called\s+)?([A-Za-z_]\w*)(?:\s+with\s+(.+))?$/i))) {
        const items = m[3] ? splitItems(m[3]).map(v => E(v, inf)) : [];
        const t = m[1] ? TYPE_WORDS[m[1].toLowerCase()] : items.length ? exprType(items[0], x) : null;
        if (!t) { inf.errs.push('C++ needs to know what the list will hold. Say "create list of numbers …" or "list of text …".'); return; }
        const type = `std::vector<${t === 'auto' ? 'int' : t}>`;
        x.needs.add('vector');
        declared.add(m[2]); x.types[m[2]] = type;
        note(inf, `A list in C++ is a \`std::vector\`, and every item has the same kind: ${code(t)}.`);
        return say(`${type} ${m[2]} = {${items.join(', ')}};`);
      }
      if ((m = s.match(/^add\s+(.+?)\s+to\s+([A-Za-z_]\w*)$/i))) {
        if (/^std::vector/.test(x.types[m[2]] || '')) { note(inf, '`push_back` adds to the end of a vector.'); return say(`${m[2]}.push_back(${E(m[1], inf)});`); }
        return say(`${m[2]} += ${E(m[1], inf)};`);
      }
      if ((m = s.match(/^increase\s+(.+?)(?:\s+by\s+(.+))?$/i))) return say(m[2] ? `${E(m[1], inf)} += ${E(m[2], inf)};` : `${E(m[1], inf)}++;`);
      if ((m = s.match(/^decrease\s+(.+?)(?:\s+by\s+(.+))?$/i))) return say(m[2] ? `${E(m[1], inf)} -= ${E(m[2], inf)};` : `${E(m[1], inf)}--;`);
      if ((m = s.match(/^run\s+([A-Za-z_][\w.:]*)(?:\s+with\s+(.+?))?(?:\s+and store (?:it |the result )?in\s+([A-Za-z_]\w*))?$/i))) {
        const call = `${m[1]}(${m[2] ? splitItems(m[2]).map(v => E(v, inf)).join(', ') : ''})`;
        if (!x.fns.has(m[1]) && !/[.:]/.test(m[1])) inf.errs.push(`There's no tool called ${code(m[1])}. Make one with "define ${m[1]} using …".`);
        return say(m[3] ? declare(m[3], 'auto', inf, call) : call + ';');
      }
      if ((m = s.match(/^(?:set|let|make)\s+([A-Za-z_]\w*)\s+(?:to|be)\s+(.+)$/i))) {
        const v = E(m[2], inf);
        return say(declare(m[1], declared.has(m[1]) ? x.types[m[1]] : exprType(v, x), inf, v));
      }
      if (/^stop the program$/i.test(s)) return say('return 0;');
      inf.errs.push('I don\'t recognise this sentence. Open the Index to see the C++ sentences, or start the line with c++: to write C++ directly.');
      say('// ??? ' + s);
    });
    while (stack.length) { const b = stack.pop(); while (b.buf.length && b.buf[b.buf.length - 1].text === '') b.buf.pop(); b.buf.push({ text: '    '.repeat(b.depth) + b.close, src: b.src }); }
    // assemble: includes, helpers, tools, main
    const all = [];
    const hdr = (text, noteText) => all.push({ text, src: -1, note: noteText });
    hdr('#include <iostream>', 'Lets the program write to and read from the terminal.');
    hdr('#include <string>', 'Lets the program use text (std::string).');
    if (x.needs.has('vector')) hdr('#include <vector>', 'Lets the program use lists (std::vector).');
    if (x.needs.has('random')) hdr('#include <random>', 'Random numbers.');
    if (x.needs.has('text')) hdr('#include <sstream>', 'Builds text from pieces.');
    hdr('', null);
    if (x.needs.has('random')) {
      ['int random_number(int low, int high) {', '    static std::mt19937 generator(std::random_device{}());', '    return std::uniform_int_distribution<int>(low, high)(generator);', '}', ''].forEach(t => hdr(t, 'A helper for "random number from … to …": picks a whole number between low and high, both included.'));
    }
    if (x.needs.has('text')) {
      ['template <typename... Parts>', 'std::string text(const Parts&... parts) {', '    std::ostringstream out;', '    (out << ... << parts);', '    return out.str();', '}', ''].forEach(t => hdr(t, 'A helper for text with {…} in it: joins the pieces and values into one std::string.'));
    }
    if (fnsOut.length) { fnsOut.forEach(o => all.push(o)); all.push({ text: '', src: -1 }); }
    all.push({ text: 'int main() {', src: -1, note: 'Every C++ program starts in `main`.' });
    mainOut.forEach(o => all.push(o));
    all.push({ text: '    return 0;', src: -1, note: 'Giving back 0 tells the computer the program finished without problems.' });
    all.push({ text: '}', src: -1 });
    all.forEach((o, idx) => { if (o.src >= 0) info[o.src].py.push(idx); });
    return { lines: all, info, text: all.map(o => o.text).join('\n') + '\n' };
  }

  function compileCppProject(project) {
    const x = { types: {}, fns: new Set(), needs: new Set() };
    const results = {};
    for (const sec of project.sections) results[sec.id] = compileCpp(sec, x);
    const syms = new Map();
    for (const [k, t] of Object.entries(x.types)) syms.set(k, { py: k, display: k, kind: /int|double/.test(t) ? 'number' : /string/.test(t) ? 'text' : /vector/.test(t) ? 'list' : 'value' });
    for (const f of x.fns) syms.set(f, { py: f, display: f, kind: 'function' });
    return { results, syms };
  }

  const T = (group, pattern, c, tip) => ({ group, pattern, py: c, tip, sections: ['program'] });
  const TEMPLATES = [
    T('Values', 'set ‹name› to ‹value›', 'int name = value;', 'The kind (int, double, std::string, bool) is worked out from the value.'),
    T('Values', 'increase ‹name› by ‹amount›', 'name += amount;', ''),
    T('Show & ask', 'show ‹value›', 'std::cout << value << std::endl;', 'Join several things with "and".'),
    T('Show & ask', 'ask for a number "‹question›" and store in ‹name›', 'std::cin >> name;', 'Or "ask … and store in …" for text.'),
    T('Decisions', 'if ‹condition›', 'if (condition) {', ''),
    T('Decisions', 'otherwise', '} else {', ''),
    T('Loops', 'repeat ‹number› times', 'for (int i = 0; i < number; i++) {', ''),
    T('Loops', 'count ‹i› from ‹1› to ‹10›', 'for (int i = 1; i <= 10; i++) {', ''),
    T('Loops', 'for each ‹item› in ‹list›', 'for (const auto& item : list) {', ''),
    T('Loops', 'while ‹condition›', 'while (condition) {', ''),
    T('Loops', 'repeat forever', 'while (true) {', 'Pair with "stop the loop".'),
    T('Lists', 'create list of ‹numbers› called ‹name› with ‹1, 2, 3›', 'std::vector<int> name = {1, 2, 3};', 'Also "list of text", "list of decimals".'),
    T('Lists', 'add ‹value› to ‹list›', 'list.push_back(value);', ''),
    T('Tools', 'define ‹name› using ‹inputs›', 'auto name(auto inputs) {', 'Tools go above main automatically.'),
    T('Tools', 'give back ‹value›', 'return value;', ''),
    T('Tools', 'run ‹tool› with ‹inputs› and store in ‹name›', 'auto name = tool(inputs);', ''),
    T('Other', 'c++: ‹code›', 'code', 'Write C++ directly.'),
  ];
  const GUIDE = {
    name: 'C++', section: 'The program runs from the top of main. Tools you define are placed above it automatically.',
    purpose: 'C++ is a fast language that is close to the hardware. It runs games, browsers, operating systems, and small devices like Arduino boards. The price of the speed: every value has a fixed kind (a type), and the program must be compiled (translated to machine code) before it runs.',
    rules: [['Types are fixed', 'A value declared as int stays a whole number. Text is std::string, decimals are double.'], ['Compile, then run', 'A compiler (g++, clang++) checks the whole program and turns it into an app first.'], ['Semicolons end statements', 'Each instruction ends with ;. Blocks go in { braces }.'], ['main is the start', 'Every program begins in int main().'], ['Memory is your job', 'Lists (std::vector) and text (std::string) manage memory for you; raw new/delete don\'t.']],
  };
  const WORDS = [['a is b', 'a == b'], ['a is not b', 'a != b'], ['a and b', 'a && b'], ['not a', '!a'], ['length of x', 'x.size()'], ['item 0 of x', 'x[0]'], ['random number from 1 to 6', 'random_number(1, 6)'], ['x as number', 'std::stoi(x)'], ['x as text', 'std::to_string(x)'], ['"Hi {name}"', 'text("Hi ", name)']];
  const OPENS_BLOCK = /^\s*(?:if |otherwise|else|repeat |count |for each |while |define |as long as |forever|keep repeating)/i;

  const api = { compileCppProject, TEMPLATES, GUIDE, WORDS, OPENS_BLOCK };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.IntuiCpp = api;
})(typeof window !== 'undefined' ? window : globalThis);

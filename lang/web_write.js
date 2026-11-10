/* IntuaCode — web language pack: sentences -> HTML, CSS and JavaScript.
 *
 * A website project has three folders:
 *   Structure  (index.html)  what is on the page
 *   Styling    (style.css)   how it looks
 *   Mechanics  (script.js)   what it does
 * They share names: "add a button called save" in Structure can be styled with
 * "style save: …" and used with "when save is clicked" in Mechanics.
 *
 * compileWebsite(project) returns the same shape as the Python pack, so the
 * editor shows code, notes, warnings and errors the same way.
 */
(function (root) {
  'use strict';

  const code = (s) => '`' + s + '`';
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const escAttr = (s) => esc(s).replace(/"/g, '&quot;');
  const toId = (s) => String(s).trim().replace(/^(?:the|my)\s+/i, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const STR = /^"((?:[^"\\]|\\.)*)"$|^'((?:[^'\\]|\\.)*)'$/;
  /* Quoted text in a sentence -> the text: \" \' and \\ stand for the character itself (other backslashes stay). */
  const strOf = (s) => { const m = String(s || '').trim().match(STR); return m ? (m[1] ?? m[2]).replace(/\\(["'\\])/g, '$1') : null; };

  function splitItems(s) {
    const parts = []; let depth = 0, quote = null, cur = '';
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (quote) { cur += c; if (c === '\\') cur += s[++i] || ''; else if (c === quote) quote = null; continue; }
      if (c === '"' || c === "'" || c === '`') { quote = c; cur += c; continue; }
      if ('([{'.includes(c)) depth++;
      if (')]}'.includes(c)) depth--;
      if (depth === 0 && c === ',') { parts.push(cur); cur = ''; continue; }
      cur += c;
    }
    parts.push(cur);
    return parts.map(p => p.trim()).filter(Boolean);
  }

  /* A plain value, not a test: no "is", "contains", "not"… ("milk", total, item 0 of xs). */
  const plainValue = (p) => !/\b(?:is|isn't|are|contains?|equals?|than|not|or|even|odd|at least|at most|ticked|checked)\b|[=<>!]/i.test(String(p).replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/g, '""'));
  /* Items separated by commas, and by "and" when every item is a plain value: "1, 2 and 3" is three items,
     but "a is 1 and b is 2" is one test. */
  function splitAnd(s) {
    const parts = splitItems(s);
    const more = parts.flatMap(p => outsideQuotes(p, (t) => t.replace(/\s+and\s+/gi, '\u0002')).split('\u0002').map(t => t.trim()).filter(Boolean));
    return more.length > parts.length && more.every(plainValue) ? more : parts;
  }

  /* Apply fn to the parts of s outside quotes. */
  function outsideQuotes(s, fn) {
    const strs = [];
    const masked = s.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/g, (m) => { strs.push(m); return `\u0001${strs.length - 1}\u0001`; });
    return fn(masked).replace(/\u0001(\d+)\u0001/g, (m, i) => strs[+i]);
  }

  /* Like s.match(re), but sentence words inside quotes never count ("send "a to b" to "/api""), and nor
     does the "by" of "divided by" ("sized width divided by 2 by 10"): they are hidden while matching
     and the groups hold the real text. */
  const withIndices = new Map();   // by source: a regex written in a function is a new object each time
  function qmatch(s, re) {
    let red = withIndices.get(re.source + '/' + re.flags);
    if (!red) { red = new RegExp(re.source, re.flags.replace(/[gd]/g, '') + 'd'); withIndices.set(re.source + '/' + re.flags, red); }
    const masked = s.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/g, (m) => m[0] + '\u0001'.repeat(m.length - 2) + m[0])
      .replace(/\bdivided\s+by\b/gi, (m) => m.replace(/\s+/, (w) => '\u0002'.repeat(w.length)));
    const m = masked.match(red);
    if (!m) return null;
    const out = m.indices.map(p => (p ? s.slice(p[0], p[1]) : undefined));
    out.index = m.index; out.input = s;
    return out;
  }

  /* Text in double quotes: {name} fills in a value, and {{ and }} are braces themselves. */
  const FILL = /\{\{|\}\}|\{([^{}]+)\}|[{}]/g;
  const fillsIn = (body) => [...body.matchAll(FILL)].some(m => m[1] != null);

  const FILLER = /^(?:(?:please|now|next|then|and then|also|just|i want to|i'd like to|let's|let us|can you|go ahead and|make sure to)\s*,?\s+)+/i;

  /* ‹Blanks› left to fill in (a hallway step, a blueprint). A blank that is text (in quotes) stays as
     it is; any other becomes _, so the rest of the line, and the rest of the page, still works. Each
     such line then has one problem: "Fill in the ‹…› slot." Notes can mention ‹blanks› freely. */
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
        else if (!q && c === '“') q = '”';   // (curly quotes count as quotes: see straightQuotes)
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

  /* Shared line machinery: indentation, info per line, output lines with their source line. */
  function makeInfo(lines) { return lines.map((_, i) => ({ line: i, py: [], notes: [], warns: [], errs: [] })); }
  function note(inf, s) { if (!inf.notes.includes(s)) inf.notes.push(s); }
  /* The blank lines that belong to exact code (js: …, css: …): the next line with something on it is exact, and so
     is the one before (or it's the start of the file). Their line numbers. */
  function blanksBetween(lines, isExact) {
    const out = new Set();
    let before = true;   // (the start of the file counts as exact)
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim()) { before = isExact(lines[i]); continue; }
      if (!before) continue;
      let j = i + 1;
      while (j < lines.length && !lines[j].trim()) j++;
      if (j < lines.length && isExact(lines[j])) for (; i < j; i++) out.add(i);
      i = j - 1;
    }
    return out;
  }

  /* Curly quotes from phones, Macs and Word (“ ” ‘ ’), used as quote marks, are straight ones: “Hi” is "Hi".
     Text already in straight quotes keeps its curly ones, and so does an apostrophe in a word (It’s). A curly
     quote with no partner stays as it is. ticks: backticks are quotes too (Mechanics). */
  const CURLY_NOTE = 'Curly quotes are taken as straight ones ("), which code needs.';
  // a regular expression in a Mechanics sentence: a / where a value starts (after "to", "matches", "(", "="…)
  const REGEX_LITERAL = /(?<=(?:^|[(,=:[!&|?{};+\-*%<>~^]|\b(?:to|is|be|at|by|with|show|matches|and|or|not|of|in|from|than))\s*)\/(?![/*])(?:[^/\\\n[]|\\.|\[(?:[^\]\\\n]|\\.)*\])+\/[dgimsuvy]*/g;
  function straightQuotes(line, ticks) {
    if (!/[“”‘]/.test(line)) return line;
    const inWord = (k) => /[\p{L}\p{N}]/u.test(line[k] || '');
    // (in Mechanics, a regular expression like /[“”]/g is kept exactly, as jsExpr keeps it)
    const regexAt = new Map();
    if (ticks) for (const r of line.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/g, (s) => '\u0001'.repeat(s.length)).matchAll(REGEX_LITERAL)) regexAt.set(r.index, r[0].length);
    let out = '', q = null;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) { out += c; if (c === '\\') out += line[++i] ?? ''; else if (c === q) q = null; continue; }
      if (regexAt.has(i)) { out += line.slice(i, i + regexAt.get(i)); i += regexAt.get(i) - 1; continue; }
      if (c === '"' || (ticks && c === '`') || (c === "'" && !inWord(i - 1))) { q = c; out += c; continue; }
      if (c === '“' || (c === '”' && !inWord(i - 1))) {   // (some phones open with ” too)
        const end = line.indexOf('”', i + 1);
        if (end > i) { out += '"' + line.slice(i + 1, end).replace(/"/g, '\\"') + '"'; i = end; continue; }
      }
      if (c === '‘' && !inWord(i - 1)) {
        // it closes at a ’ that isn't an apostrophe inside a word (It’s)
        let end = -1;
        for (let k = i + 1; k < line.length; k++) if (line[k] === '’' && !inWord(k + 1)) { end = k; break; }
        if (end > i) { out += "'" + line.slice(i + 1, end).replace(/'/g, "\\'") + "'"; i = end; continue; }
      }
      out += c;
    }
    return out;
  }

  /* ================================================================== */
  /* HTML: Structure                                                     */
  /* ================================================================== */

  const CONTAINERS = {
    section: 'section', header: 'header', footer: 'footer', 'navigation bar': 'nav', navigation: 'nav', nav: 'nav', 'main area': 'main', main: 'main',
    'main content': 'main', block: 'div', box: 'div', area: 'div', form: 'form', 'side panel': 'aside', sidebar: 'aside', article: 'article', card: 'div',
    list: 'ul', 'numbered list': 'ol', table: 'table', row: 'tr', 'pop-up': 'dialog', dialog: 'dialog',
  };
  const INPUTS = { text: 'text', number: 'number', password: 'password', email: 'email', date: 'date', time: 'time', search: 'search', colour: 'color', color: 'color' };
  const KEYPADS = { number: 'numeric', numbers: 'numeric', decimal: 'decimal', phone: 'tel', email: 'email', search: 'search', url: 'url', web: 'url' };
  const PICKS = { picture: 'image/*', pictures: 'image/*', photo: 'image/*', photos: 'image/*', image: 'image/*', images: 'image/*', sound: 'audio/*', sounds: 'audio/*', song: 'audio/*', songs: 'audio/*', audio: 'audio/*', music: 'audio/*', video: 'video/*', videos: 'video/*', 'text file': '.txt,text/plain', 'text files': '.txt,text/plain' };

  /* Every element in plain words: [tag, the word said for it, other words accepted]. Words for text
     ("bold text") take no "a". Inside a drawing (<svg>) the drawing's own words are used. Any other tag
     is "add a ‹tag› element". */
  const ELEMENT_WORDS = [
    ['div', 'block', 'box', 'area'], ['span', 'text'], ['p', 'paragraph'], ['h1', 'big heading'], ['h2', 'heading'], ['h3', 'small heading'],
    ['h4', 'level 4 heading'], ['h5', 'level 5 heading'], ['h6', 'level 6 heading'], ['section', 'section'], ['header', 'header'], ['footer', 'footer'],
    ['nav', 'navigation bar', 'navigation', 'nav'], ['main', 'main area', 'main content', 'main'], ['aside', 'side panel', 'sidebar'], ['article', 'article'],
    ['form', 'form'], ['ul', 'list'], ['ol', 'numbered list'], ['li', 'list item', 'item'], ['table', 'table'], ['tr', 'row'], ['td', 'cell'], ['th', 'heading cell'],
    ['thead', 'table head'], ['tbody', 'table body'], ['tfoot', 'table foot'], ['caption', 'table caption'], ['dialog', 'dialog', 'pop-up'],
    ['figure', 'figure'], ['figcaption', 'caption'], ['details', 'collapsible section'], ['summary', 'summary'], ['dl', 'definition list'], ['dt', 'term'],
    ['dd', 'definition'], ['blockquote', 'quotation'], ['q', 'short quotation'], ['cite', 'citation'], ['address', 'address'], ['hgroup', 'heading group'],
    ['menu', 'menu'], ['search', 'search area'], ['fieldset', 'field group'], ['legend', 'legend'], ['a', 'link'], ['button', 'button'], ['label', 'label'],
    ['img', 'picture', 'image', 'photo'], ['input', 'input'], ['select', 'drop-down', 'dropdown'], ['option', 'option'], ['optgroup', 'option group'],
    ['textarea', 'big text box'], ['output', 'output'], ['progress', 'progress bar'], ['meter', 'meter'], ['video', 'video'], ['audio', 'sound player'],
    ['source', 'media source'], ['track', 'captions track'], ['iframe', 'embedded page'], ['canvas', 'drawing area', 'canvas'], ['br', 'line break'], ['hr', 'line'],
    ['svg', 'drawing'], ['script', 'script'], ['strong', 'strong text'], ['em', 'emphasised text', 'emphasized text'], ['b', 'bold text'], ['i', 'italic text'],
    ['u', 'underlined text'], ['s', 'struck-out text'], ['small', 'small text'], ['mark', 'highlighted text'], ['sub', 'subscript'], ['sup', 'superscript'],
    ['abbr', 'abbreviation'], ['code', 'code'], ['kbd', 'key'], ['samp', 'sample output'], ['var', 'variable'], ['time', 'time'], ['del', 'deleted text'],
    ['ins', 'inserted text'],
  ];
  const SVG_WORDS = [
    ['svg', 'drawing'], ['g', 'set of shapes'], ['defs', 'reusable parts'], ['circle', 'circle'], ['ellipse', 'ellipse'], ['rect', 'rectangle'], ['line', 'line'],
    ['polyline', 'polyline'], ['polygon', 'polygon'], ['path', 'path'], ['text', 'text'], ['tspan', 'text piece'], ['use', 'copy'], ['image', 'picture', 'image'],
    ['linearGradient', 'gradient'], ['radialGradient', 'radial gradient'], ['stop', 'colour stop', 'color stop'], ['pattern', 'pattern'], ['clipPath', 'clipping shape'],
    ['mask', 'mask'], ['symbol', 'symbol'], ['marker', 'marker'], ['title', 'title'], ['desc', 'description'], ['a', 'link'], ['foreignObject', 'page area'],
  ];
  const wordTable = (rows) => { const m = new Map(); for (const [tag, ...ws] of rows) for (const w of ws) if (!m.has(w)) m.set(w, tag); return m; };
  const HTML_WORD_TAG = wordTable(ELEMENT_WORDS), SVG_WORD_TAG = wordTable(SVG_WORDS);
  const wordRe = (m) => new RegExp(`^add\\s+(?:(?:a|an|some)\\s+)?(${[...m.keys()].sort((x, y) => y.length - x.length).map(w => w.replace(/[-]/g, '\\-')).join('|')})(?=[\\s,]|$)(.*)$`, 'i');
  const HTML_WORD_RE = wordRe(HTML_WORD_TAG), SVG_WORD_RE = wordRe(SVG_WORD_TAG);
  /* The word for an element, as the reader says it: "a block", "bold text", "a gradient", or "a my-widget element". */
  function elementWord(tag, svg) {
    const row = (svg ? SVG_WORDS : ELEMENT_WORDS).find(r => r[0].toLowerCase() === tag.toLowerCase());
    const w = row ? row[1] : /^[A-Za-z][\w-]*$/.test(tag) ? `${tag} element` : null;
    if (!w) return null;
    return /(?:^|\s)text$|^code$|^reusable parts$/.test(w) ? w : `${/^[aeiou]/i.test(w) ? 'an' : 'a'} ${w}`;
  }
  const VOID_TAGS = new Set(['img', 'input', 'hr', 'br', 'meta', 'link', 'source', 'track', 'wbr', 'col', 'area', 'embed', 'base', 'param']);
  // as the browser lays them out: spaces next to these, or at their inner edges, don't show (see convert.js)
  const BLOCK_TAGS = /^(?:html|head|body|address|article|aside|blockquote|center|details|dialog|dd|div|dl|dt|fieldset|figcaption|figure|footer|form|h[1-6]|header|hgroup|hr|li|main|nav|ol|p|pre|search|section|table|tbody|thead|tfoot|tr|td|th|caption|colgroup|col|ul|summary|legend|menu|optgroup|option|br|title|meta|link|base|listing)$/;
  const OWN_BOX_TAGS = /^(?:button|select|textarea|input|img|video|audio|canvas|iframe|object|embed|meter|progress|svg|math)$/;

  /* Names in sentences: a plain name (called save) is made into an id the way "called" always has; a name
     in quotes (called "helpToggle") is kept exactly. Several are joined with "and". */
  const NAME_TOKEN = `"(?:[^"\\\\]|\\\\.)*"|[\\w-]+`;
  // (a name in quotes is kept exactly, "helpToggle", unless it has spaces, which a name in the page can't:
  // called "main description" is main-description, as called main description is)
  const nameOf = (t) => { const q = strOf(t); return q != null ? (/\s/.test(q.trim()) ? toId(q) : q) : toId(t); };
  const namesOf = (t) => { const parts = outsideQuotes(t, (s) => s.replace(/\s+and\s+/gi, '\u0002')).split('\u0002').map(s => s.trim()); return parts.every(p => new RegExp(`^(?:${NAME_TOKEN})$`).test(p)) ? parts.map(nameOf).join(' ') : null; };
  /* A value in a phrase: text in quotes, or one word or number as it is (#873044, .4, userSpaceOnUse). */
  const valueOf = (t) => { t = String(t).trim(); const q = strOf(t); return q != null ? q : /^[^\s"',]+$/.test(t) ? t : null; };
  const NUM = `-?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:e[-+]?\\d+)?(?:%|px|em|rem)?|"[^"]*"`;

  /* A link's or a picture's address as a sentence says it -> { value, note }: the address the page needs, and a
     note when that isn't what was written. google.com is https://google.com (without it, the browser looks for a
     file called "google.com" next to the page), me@example.com is mailto:…, a phone number is tel:…, localhost is
     http://localhost, a place on the page (#main display) is a name, and a space is %20. Anything else stays as
     it is: about.html, /, #top, https://…, javascript:… kind: 'href' (a link) or 'src' (a picture, a video). */
  const TLDS = 'com|org|net|edu|gov|mil|int|io|co|app|dev|ai|me|info|biz|tv|xyz|site|online|store|shop|tech|blog|news|page|cloud|live|fm|gg|ly|cc|us|uk|au|nz|ca|de|fr|es|it|nl|se|no|dk|fi|ie|jp|cn|in|br|za|ch|at|be|pl|ru|kr|sg|hk|mx|ar|eu|asia';
  const LABEL = '[a-z0-9](?:[a-z0-9-]*[a-z0-9])?';
  const WEB_ADDRESS = new RegExp(`^(?:www\\.)?${LABEL}(?:\\.${LABEL})*\\.(?:${TLDS})(?::\\d+)?(?:[/?#].*)?$`, 'i');
  const EMAIL = /^[^\s@/:?#"<>]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}(?:\?\S*)?$/i;
  function address(t, kind) {
    const v = String(t);
    if (!v.trim() || v !== v.trim()) return { value: v };
    if (kind === 'href' && /^#/.test(v)) {
      const id = toId(v.slice(1));
      return /\s/.test(v) && id ? { value: '#' + id, note: `A place on the page is found by its name, and a name can't have spaces, so ${code(v)} is ${code('#' + id)}.` } : { value: v };
    }
    if (kind === 'href' && EMAIL.test(v)) return { value: 'mailto:' + v, note: `An email address in a link starts with mailto:, so it opens a new email: ${code('mailto:' + v)}.` };
    // (a phone number: +61 400 123 456, 0400 123 456, (02) 9999 1234, 555-123-4567; not 2024-01-01 or an IP address)
    if (kind === 'href' && /^\+?[\d\s()-]+$/.test(v) && (v.match(/\d/g) || []).length >= 6 && (/^[+0(]|\s/.test(v) || /^\d{3}-\d{3,4}(?:-\d{4})?$/.test(v))) {
      const tel = 'tel:' + v.replace(/[\s()-]/g, '');
      return { value: tel, note: `A phone number in a link starts with tel:, so phones offer to call it: ${code(tel)}.` };
    }
    let out = v, why = null;
    // (this computer, or one on the network, is http://; anywhere else, https://)
    const scheme = /^(?:localhost|\d{1,3}(?:\.\d{1,3}){3})(?::\d+)?(?:[/?#].*)?$/i.test(v) ? 'http://' : WEB_ADDRESS.test(v) ? 'https://' : null;
    if (scheme) { out = scheme + v; why = `Without ${scheme}, the browser would look for a file called ${code(v)} next to the page, so it's ${code(out)}.`; }
    else if (/^[a-z][a-z0-9+.-]*:/i.test(v) && !/^https?:/i.test(v)) return { value: v };   // mailto:, tel:, javascript:… as written
    if (/\s/.test(out)) {
      out = out.replace(/\s/g, (c) => encodeURIComponent(c));
      why = (why ? why + ' ' : '') + `An address can't have spaces, so each one is %20 (the browser reads it as a space): ${code(out)}.`;
    }
    return why ? { value: out, note: why } : { value: v };
  }

  const EVENT_WORDS = { click: 'when clicked', change: 'when changed', input: 'when typed in', submit: 'when sent', load: 'when loaded' };

  /* One attribute phrase ("hidden from screen readers", "controls help-panel", "storing chord "C"") ->
     [[name, value], …] (a value of null takes the attribute away), { glued: true } for "with no space before
     it", or null when it isn't one. ctx: { tag, svg } of the element it is on. */
  function readAttr(seg, ctx = {}) {
    const s = String(seg).trim();
    let m;
    const one = (n, v) => (v == null ? null : [[n, v]]);
    if (/^with no space before it$/i.test(s)) return { glued: true };
    // "with id main display": an id of several words, without quotes, is those words joined (main-display)
    if ((m = s.match(/^with (?:the )?id\s+([a-z][\w-]*(?:\s+[\w-]+)+)$/i))) return [['id', toId(m[1])]];
    if (/^hidden from screen readers$/i.test(s)) return [['aria-hidden', 'true']];
    if ((m = s.match(/^labell?ed\s+(.+?)\s+for screen readers$/i))) return one('aria-label', strOf(m[1]));
    if ((m = s.match(/^labell?ed by\s+(.+)$/i))) return one('aria-labelledby', namesOf(m[1]));
    if ((m = s.match(/^described by\s+(.+)$/i))) return one('aria-describedby', namesOf(m[1]));
    if ((m = s.match(/^controls\s+(.+)$/i))) return one('aria-controls', namesOf(m[1]));
    if ((m = s.match(/^starts (collapsed|expanded)$/i))) return [['aria-expanded', /^expanded$/i.test(m[1]) ? 'true' : 'false']];
    if ((m = s.match(/^starts (not )?pressed$/i))) return [['aria-pressed', m[1] ? 'false' : 'true']];
    if ((m = s.match(/^marked as (?:the )?current(?:\s+(.+))?$/i))) return one('aria-current', m[1] ? valueOf(m[1]) : 'true');
    if ((m = s.match(/^read out (at once )?when it changes$/i))) return [['aria-live', m[1] ? 'assertive' : 'polite']];
    if ((m = s.match(/^with (?:a )?tooltip\s+(.+)$/i))) return one('title', strOf(m[1]));
    if ((m = s.match(/^with (?:a )?hint\s+(.+)$/i))) return one('placeholder', strOf(m[1]));
    if (/^opening in a new tab$/i.test(s)) return [['target', '_blank']];
    if ((m = s.match(/^sent as\s+(.+)$/i))) return one('name', strOf(m[1]));
    if ((m = s.match(/^sending to\s+(.+)$/i))) return one('action', strOf(m[1]));
    if ((m = s.match(/^storing\s+([a-z][\w.-]*)\s+(.+)$/i))) return one('data-' + m[1], valueOf(m[2]));
    if ((m = s.match(/^running\s+(.+?)\s+(when clicked|when changed|when typed in|when sent|when loaded|on [a-z]+)$/i))) {
      const ev = Object.keys(EVENT_WORDS).find(k => EVENT_WORDS[k] === m[2].toLowerCase()) || m[2].replace(/^on\s+/i, '').toLowerCase();
      return one('on' + ev, strOf(m[1]));
    }
    // (an address that isn't one a page can use as written comes with a note saying what it became: see address)
    const at = (n, t, kind) => { if (t == null) return null; const a = address(t, kind); return [a.note ? [n, a.value, a.note] : [n, a.value]]; };
    if ((m = s.match(/^linking to\s+(.+)$/i))) return at('href', strOf(m[1]), 'href');
    if ((m = s.match(/^from\s+("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')$/i))) return at('src', strOf(m[1]), 'src');
    if ((m = s.match(/^described as\s+(.+)$/i))) return one('alt', strOf(m[1]));
    if (/^with no description$/i.test(s)) return [['alt', null]];
    if ((m = s.match(/^for\s+(.+)$/i))) return one('for', namesOf(m[1]));
    if ((m = s.match(new RegExp(`^sized\\s+(${NUM})\\s+by\\s+(${NUM})$`, 'i')))) return [['width', valueOf(m[1])], ['height', valueOf(m[2])]];
    if ((m = s.match(new RegExp(`^(${NUM})\\s+wide$`, 'i')))) return [['width', valueOf(m[1])]];
    if ((m = s.match(new RegExp(`^(${NUM})\\s+tall$`, 'i')))) return [['height', valueOf(m[1])]];
    if ((m = s.match(/^of type\s+(.+)$/i))) return one('type', valueOf(m[1]));
    if ((m = s.match(new RegExp(`^drawn on a\\s+(${NUM})\\s+by\\s+(${NUM})\\s+grid$`, 'i')))) return [['viewBox', `0 0 ${valueOf(m[1])} ${valueOf(m[2])}`]];
    if (/^with the svg namespace$/i.test(s)) return [['xmlns', 'http://www.w3.org/2000/svg']];
    if (ctx.svg) {
      const paint = (t) => { const g = t.match(/^the (?:gradient|pattern|clipping shape|mask|marker)\s+(.+)$/i); if (g) { const n = new RegExp(`^(?:${NAME_TOKEN})$`).test(g[1].trim()) ? nameOf(g[1].trim()) : null; return n == null ? null : `url(#${n})`; } return valueOf(t); };
      if ((m = s.match(/^filled with\s+(.+)$/i))) return one('fill', paint(m[1]));
      if (/^not filled$/i.test(s)) return [['fill', 'none']];
      if ((m = s.match(/^outlined in\s+(.+)$/i))) return one('stroke', paint(m[1]));
      if (/^not outlined$/i.test(s)) return [['stroke', 'none']];
      if ((m = s.match(new RegExp(`^outline\\s+(${NUM})\\s+wide$`, 'i')))) return [['stroke-width', valueOf(m[1])]];
      if ((m = s.match(new RegExp(`^with rounded corners\\s+(${NUM})$`, 'i')))) return [['rx', valueOf(m[1])]];
      if ((m = s.match(new RegExp(`^with radius\\s+(${NUM})$`, 'i')))) return [['r', valueOf(m[1])]];
      if ((m = s.match(new RegExp(`^with radii\\s+(${NUM})\\s+and\\s+(${NUM})$`, 'i')))) return [['rx', valueOf(m[1])], ['ry', valueOf(m[2])]];
      if ((m = s.match(new RegExp(`^(starting|ending)(?:\\s+(${NUM})\\s+across)?(?:\\s+and)?(?:\\s+(${NUM})\\s+down)?$`, 'i'))) && (m[2] || m[3])) {
        const [x, y] = /^starting$/i.test(m[1]) ? ['x1', 'y1'] : ['x2', 'y2'];
        return [...(m[2] ? [[x, valueOf(m[2])]] : []), ...(m[3] ? [[y, valueOf(m[3])]] : [])];
      }
    }
    const FLAGS = { hidden: 'hidden', disabled: 'disabled', required: 'required', 'read-only': 'readonly', ticked: 'checked', selected: 'selected', 'focused at the start': 'autofocus', 'allowing several': 'multiple', 'with controls': 'controls', 'playing by itself': 'autoplay', 'on a loop': 'loop', muted: 'muted', 'open at the start': 'open' };
    if (FLAGS[s.toLowerCase()]) return [[FLAGS[s.toLowerCase()], '']];
    if (/^loaded lazily$/i.test(s)) return [['loading', 'lazy']];
    // any other attribute: with name "value", with name value, or just with name
    if ((m = s.match(/^with (?:attribute )?([A-Za-z_:][\w:.-]*)(?:\s+(.+))?$/))) {
      const v = m[2] == null ? '' : valueOf(m[2]);
      return v == null ? null : [[m[1], v]];
    }
    return null;
  }
  /* The phrase for one attribute (or null): the shortest that reads back as exactly it. */
  function sayAttr(name, value, ctx = {}) {
    const n = String(name), low = n.toLowerCase(), v = value == null ? '' : String(value);
    // (a value with curly quotes goes in straight ones, or the curly ones would be read as quotes)
    const q = (t) => quoteText(t), val = (t) => (/^[^\s"',\\“”‘’]+$/.test(t) && t !== '' ? t : quoteText(t));
    const names = (t) => { const ps = t.trim().split(/\s+/); return t.trim() && ps.every(p => toId(p) === p && /^[a-z]/.test(p)) ? ps.join(' and ') : q(t); };
    const tries = [];
    const ev = low.match(/^on([a-z]+)$/);
    switch (low) {
      case 'aria-hidden': if (v === 'true') tries.push('hidden from screen readers'); break;
      case 'aria-label': tries.push(`labelled ${q(v)} for screen readers`); break;
      case 'aria-labelledby': tries.push(`labelled by ${names(v)}`); break;
      case 'aria-describedby': tries.push(`described by ${names(v)}`); break;
      case 'aria-controls': tries.push(`controls ${names(v)}`); break;
      case 'aria-expanded': if (v === 'false') tries.push('starts collapsed'); if (v === 'true') tries.push('starts expanded'); break;
      case 'aria-pressed': if (v === 'false') tries.push('starts not pressed'); if (v === 'true') tries.push('starts pressed'); break;
      case 'aria-current': tries.push(v === 'true' ? 'marked as current' : `marked as the current ${val(v)}`); break;
      case 'aria-live': if (v === 'polite') tries.push('read out when it changes'); if (v === 'assertive') tries.push('read out at once when it changes'); break;
      case 'title': tries.push(`with tooltip ${q(v)}`); break;
      case 'placeholder': tries.push(`with hint ${q(v)}`); break;
      case 'target': if (v === '_blank') tries.push('opening in a new tab'); break;
      case 'name': if (/^(?:input|select|textarea|button)$/.test(ctx.tag || '')) tries.push(`sent as ${q(v)}`); break;
      case 'action': tries.push(`sending to ${q(v)}`); break;
      case 'href': if (ctx.tag !== 'a') tries.push(`linking to ${q(v)}`); break;
      case 'src': tries.push(`from ${q(v)}`); break;
      case 'alt': tries.push(`described as ${q(v)}`); break;
      case 'for': tries.push(`for ${names(v)}`); break;
      case 'width': tries.push(`${val(v)} wide`); break;
      case 'height': tries.push(`${val(v)} tall`); break;
      case 'type': tries.push(`of type ${val(v)}`); break;
      case 'viewbox': { const g = v.match(/^0 0 (\S+) (\S+)$/); if (g && /^\d+(?:\.\d+)?$/.test(g[1] + g[2]) && /^\d+(?:\.\d+)?$/.test(g[2])) tries.push(`drawn on a ${g[1]} by ${g[2]} grid`); break; }
      case 'xmlns': tries.push('with the svg namespace'); break;
      case 'fill': case 'stroke': {
        const word = low === 'fill' ? 'filled with' : 'outlined in';
        if (v === 'none') tries.push(low === 'fill' ? 'not filled' : 'not outlined');
        const u = v.match(/^url\(#([^)\s"']+)\)$/);
        if (u && ctx.refs && ctx.refs[u[1]]) tries.push(`${word} the ${ctx.refs[u[1]]} ${names(u[1]) === u[1] ? u[1] : q(u[1])}`);
        tries.push(`${word} ${val(v)}`);
        break;
      }
      case 'stroke-width': tries.push(`outline ${val(v)} wide`); break;
      case 'rx': if (ctx.tag === 'rect') tries.push(`with rounded corners ${val(v)}`); break;
      case 'loading': if (v === 'lazy') tries.push('loaded lazily'); break;
      default: {
        if (ev) tries.push(`running ${q(v)} ${EVENT_WORDS[ev[1]] || 'on ' + ev[1]}`);
        if (/^data-[a-z][\w.-]*$/.test(low) && n === low) tries.push(`storing ${n.slice(5)} ${/^-?\d*\.?\d+$/.test(v) ? v : q(v)}`);
      }
    }
    const FLAG_SAY = { hidden: 'hidden', disabled: 'disabled', required: 'required', readonly: 'read-only', checked: 'ticked', selected: 'selected', autofocus: 'focused at the start', multiple: 'allowing several', controls: 'with controls', autoplay: 'playing by itself', loop: 'on a loop', muted: 'muted', open: 'open at the start' };
    if (v === '' && FLAG_SAY[low]) tries.push(FLAG_SAY[low]);
    // (an attribute written with ="" is said with "", one written alone is said alone: the same to the browser)
    const bare = value == null || (v === '' && FLAG_SAY[low]);
    tries.push(bare ? `with ${n}` : `with ${n} ${val(v)}`, bare ? `with attribute ${n}` : `with attribute ${n} ${val(v)}`);
    for (const t of tries) {
      const r = readAttr(t, ctx);
      if (Array.isArray(r) && r.length === 1 && r[0][0].toLowerCase() === low && (r[0][1] ?? '') === v) return t;
    }
    return null;
  }
  /* Text in quotes for a sentence: \" \' and \\ stand for the character itself. */
  const quoteText = (t) => { const s = String(t).replace(/\\/g, '\\\\'); return !s.includes('"') ? `"${s}"` : !s.includes("'") ? `'${s}'` : `"${s.replace(/"/g, '\\"')}"`; };

  /* The phrases at the end of a Structure sentence, after commas: "…, hidden from screen readers, controls menu".
     Takes them off the end (last first) and gives back what's left, the attributes in order, and the glue. */
  function takePhrases(s, ctx) {
    const cuts = [];
    for (let k = 1; ; k++) { const at = nthTopComma(s, k); if (at >= s.length) break; cuts.push(at); }
    const attrs = [];
    let glued = false, end = s.length;
    for (let k = cuts.length - 1; k >= 0; k--) {
      const r = readAttr(s.slice(cuts[k] + 1, end), ctx);
      if (!r) break;
      if (r.glued) glued = true; else attrs.unshift(...r);
      end = cuts[k];
    }
    return { rest: s.slice(0, end).trim(), attrs, glued };
  }
  /* Where the nth top-level comma is (outside quotes and brackets), counting from 1. */
  function nthTopComma(s, nth) {
    let depth = 0, quote = null, count = 0;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (quote) { if (c === '\\') i++; else if (c === quote) quote = null; continue; }
      if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
      if ('([{'.includes(c)) depth++;
      if (')]}'.includes(c)) depth--;
      if (depth === 0 && c === ',' && ++count === nth) return i;
    }
    return s.length;
  }

  /* The head of a drawing shape, after its word: "at 10, 20 sized 30 by 40", "with radius 5", "from 0, 0 to 9, 9",
     "following "M 0 0 L 9 9"", "through "0,0 9,9"". Gives back the attributes in order, or null. */
  function shapeHead(tag, t) {
    const attrs = [];
    let rest = t.trim(), m;
    const pos = /^(?:circle|ellipse|radialGradient)$/.test(tag) ? ['cx', 'cy'] : ['x', 'y'];
    const take = (re, fn) => { const r = rest.match(re); if (!r) return false; fn(r); rest = rest.slice(r[0].length).trim(); return true; };
    for (let guard = 0; guard < 8 && rest; guard++) {
      const ok =
        (tag === 'line' && take(new RegExp(`^from\\s+(${NUM}),\\s*(${NUM})\\s+to\\s+(${NUM}),\\s*(${NUM})`, 'i'), (r) => attrs.push(['x1', valueOf(r[1])], ['y1', valueOf(r[2])], ['x2', valueOf(r[3])], ['y2', valueOf(r[4])]))) ||
        take(new RegExp(`^at\\s+(${NUM}),\\s*(${NUM})`, 'i'), (r) => attrs.push([pos[0], valueOf(r[1])], [pos[1], valueOf(r[2])])) ||
        take(new RegExp(`^sized\\s+(${NUM})\\s+by\\s+(${NUM})`, 'i'), (r) => attrs.push(['width', valueOf(r[1])], ['height', valueOf(r[2])])) ||
        take(new RegExp(`^with radius\\s+(${NUM})`, 'i'), (r) => attrs.push(['r', valueOf(r[1])])) ||
        take(new RegExp(`^with radii\\s+(${NUM})\\s+and\\s+(${NUM})`, 'i'), (r) => attrs.push(['rx', valueOf(r[1])], ['ry', valueOf(r[2])])) ||
        (tag === 'path' && take(/^following\s+("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/i, (r) => attrs.push(['d', strOf(r[1])]))) ||
        (/^(?:polyline|polygon)$/.test(tag) && take(/^through\s+("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/i, (r) => attrs.push(['points', strOf(r[1])]))) ||
        (tag === 'use' && take(new RegExp(`^of\\s+(${NAME_TOKEN})`, 'i'), (r) => attrs.push(['href', '#' + nameOf(r[1])])));
      if (!ok) return null;
    }
    return attrs;
  }
  /* A gradient's colours: "from #fff through #888 at .4 to #000 at 1" -> its <stop>s. */
  function gradientStops(t) {
    const COL = `#[0-9a-fA-F]{3,8}|[A-Za-z]+|"[^"]*"`;
    const re = new RegExp(`^(from|through|to)\\s+(${COL})(?:\\s+at\\s+(${NUM}))?(?:\\s+|$)`, 'i');
    const stops = [];
    let rest = t.trim(), m, want = 'from';
    while (rest && (m = rest.match(re))) {
      const w = m[1].toLowerCase();
      if (w !== want && !(want === 'through' && w === 'to')) return null;
      stops.push([...(m[3] != null ? [['offset', valueOf(m[3])]] : []), ['stop-color', valueOf(m[2])]]);
      rest = rest.slice(m[0].length).trim();
      if (w === 'to') { want = null; break; }
      want = 'through';
    }
    return rest || !stops.length || (stops.length > 1 && want !== null) ? null : stops;
  }

  /* "add a caption "…"", "add bold text called x", "add a circle at 10, 10 with radius 8", "add a my-widget element":
     any element, said generically. ctx: { svg } when inside a drawing. */
  function genericElement(s, inf, ctx) {
    let m = s.match(ctx.svg ? SVG_WORD_RE : HTML_WORD_RE), tag;
    if (m) tag = (ctx.svg ? SVG_WORD_TAG : HTML_WORD_TAG).get(m[1].toLowerCase());
    else if ((m = s.match(/^add\s+(?:a|an)\s+([A-Za-z][\w-]*)\s+element(?=[\s,]|$)(.*)$/i))) tag = m[1];
    else return null;
    let rest = m[2];
    const r = rest.match(new RegExp(`^(?:\\s+(?:called|named)\\s+(${NAME_TOKEN}))?(?:\\s+("(?:[^"\\\\]|\\\\.)*"|'(?:[^'\\\\]|\\\\.)*'))?(.*)$`, 'i'));
    const id = r[1] ? nameOf(r[1]) : null;
    const text = r[2] ? strOf(r[2]) : null;
    rest = r[3].trim().replace(/^,\s*/, '');
    let attrs = [], children = null;
    if (/^(?:linearGradient|radialGradient)$/.test(tag) && /^from\s/i.test(rest)) {
      const stops = gradientStops(rest);
      if (!stops) { inf.errs.push('Say a gradient\'s colours like: from #ffffff through #888888 at .5 to #000000'); return null; }
      children = stops.map(a => ({ tag: 'stop', attrs: Object.fromEntries(a), groups: [], id: null, svg: true }));
      rest = '';
    }
    if (rest) {
      const head = ctx.svg || tag === 'svg' ? shapeHead(tag, rest) : null;
      if (!head) return null;
      attrs = head;
    }
    const el = { tag, id, groups: [], attrs: Object.fromEntries(attrs), text, container: !VOID_TAGS.has(tag.toLowerCase()) || ctx.svg, svg: ctx.svg || tag === 'svg', generic: true };
    if (children) el.children = children, el.fixed = true;
    if (tag === 'button') el.attrs = { type: 'button', ...el.attrs };
    return el;
  }

  /* Things that belong in Styling or Mechanics, said in Structure: where to write them instead. */
  const ELSEWHERE = [
    [/^add\s+(?:a\s+|an\s+|some\s+)?(border|outline|background(?: colou?r)?|colou?r|shadow|rounded corners|round corners|padding|margin|space(?: inside| around)?|font|gap)\b/i,
      (w) => `A ${w.toLowerCase()} is how something looks, so it goes in Styling (style.css), like ${/border|outline|shadow|corner/i.test(w) ? `"add ${/s$/i.test(w) ? '' : 'a '}${w.toLowerCase()} to ‹name›" or ` : ''}style ‹name›: ${/border|outline/i.test(w) ? 'border 2 solid navy' : /shadow/i.test(w) ? 'shadow' : /corner/i.test(w) ? 'rounded corners 8' : /padding|inside/i.test(w) ? 'space inside 12' : /margin|around/i.test(w) ? 'space around 12' : /font/i.test(w) ? 'font Inter' : /gap/i.test(w) ? 'gap 12' : /colou?r$/i.test(w) && !/background/i.test(w) ? 'text colour navy' : 'background navy'}. Give the element a name here first ("called ‹name›").`],
    [/^add\s+(?:a\s+|an\s+)?(click|animation|timer|sound)\b/i, (w) => `A ${w.toLowerCase()} is something the page does, so it goes in Mechanics (script.js), like: when ‹name› is clicked.`],
    [/^add\s+(?:a\s+|the\s+)?(?:page\s+)?title\b/i, () => 'The page\'s title (in the browser tab) is written: page title is "…". A title shown on the page is a heading: add a big heading "…".'],
    [new RegExp(`^add\\s+(?:a\\s+|an\\s+|some\\s+)?(${SVG_WORDS.flatMap(r => r.slice(1)).filter(w => !HTML_WORD_TAG.has(w) && !/^(?:title|description|page area)$/.test(w)).join('|')})\\b`, 'i'),
      (w) => `A ${w.toLowerCase()} is drawn inside a drawing: write "add a drawing sized 200 by 100" first and indent this under it.`],
  ];

  /* "in group card", "in groups a, b and c", in group "main area": the groups (classes) at the end of a line.
     A name in quotes is kept exactly, unless it has spaces, which a class can't: "main area" is main-area. */
  const GROUP_PART = String.raw`(?:"[^"]*"|'[^']*'|[\w-]+(?:\s+[\w-]+)*)`;
  const GROUP_LIST = String.raw`(${GROUP_PART}(?:\s*,\s*${GROUP_PART}|\s+and\s+${GROUP_PART})*)$`;
  const IN_GROUPS = new RegExp(String.raw`\s+in groups?\s+` + GROUP_LIST, 'i'), PAGE_GROUPS = new RegExp(String.raw`^the (?:whole )?page is in groups?\s+` + GROUP_LIST, 'i');
  function groupsOf(t, inf) {
    const parts = outsideQuotes(t, (s) => s.replace(/\s*,\s*|\s+and\s+/gi, '\u0002')).split('\u0002').map(p => p.trim()).filter(Boolean);
    return parts.map(p => {
      const q = strOf(p);
      if (q == null) return toId(p);
      const g = /\s/.test(q.trim()) ? toId(q) : q.trim();
      if (g !== q && inf) note(inf, `A group can't have spaces in a page, so ${code(q)} is ${code(g)}.`);
      return g;
    }).filter(Boolean);
  }

  /* The settings after a box's name, in any order: "with hint "4.50", allowing decimals, from 0 to 100".
     Takes them off the end of t (quotes are kept whole) and gives back the attributes and what's left. */
  function inputSettings(t, inf) {
    const attrs = {}, said = [];
    let rest = t;
    const take = (re, fn) => {
      const masked = rest.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, (q) => q[0] + '\u0001'.repeat(q.length - 2) + q[0]);
      const m = masked.match(re);
      if (!m) return false;
      fn(rest.slice(m.index, m.index + m[0].length).match(re));
      rest = rest.slice(0, m.index) + rest.slice(m.index + m[0].length);
      return true;
    };
    const num = (v) => /^-?\d+(?:\.\d+)?$/.test(v);
    for (let guard = 0; guard < 8; guard++) {
      const found =
        take(/,?\s+(?:and\s+)?with (?:a\s+)?hint\s+("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/i, (m) => { attrs.placeholder = strOf(m[1]); }) ||
        take(/,?\s+(?:and\s+)?(?:allowing|that (?:allows|takes)|taking) decimals\b/i, () => { attrs.step = 'any'; said.push('`step="any"` lets it take decimals, like 4.50; a number box takes whole numbers otherwise.'); }) ||
        take(/,?\s+(?:and\s+)?in steps of\s+(\S+)/i, (m) => { attrs.step = m[1]; said.push(`\`step\` is how far apart the allowed numbers are: ${m[1]}.`); }) ||
        take(/,?\s+(?:and\s+)?from\s+(-?[\d.]+)\s+to\s+(-?[\d.]+)/i, (m) => { attrs.min = m[1]; attrs.max = m[2]; said.push(`\`min\` and \`max\`: the lowest and highest numbers it accepts.`); }) ||
        take(/,?\s+(?:and\s+)?at least\s+(-?[\d.]+)/i, (m) => { attrs.min = m[1]; said.push('`min` is the lowest number it accepts.'); }) ||
        take(/,?\s+(?:and\s+)?at most\s+(-?[\d.]+)/i, (m) => { attrs.max = m[1]; said.push('`max` is the highest number it accepts.'); }) ||
        take(/,?\s+(?:and\s+)?with an? (number|numbers|decimal|phone|email|search|url|web) keypad/i, (m) => { attrs.inputmode = KEYPADS[m[1].toLowerCase()]; said.push(`\`inputmode="${attrs.inputmode}"\` asks phones for that keypad.`); });
      if (!found) break;
    }
    for (const k of ['min', 'max']) if (attrs[k] != null && !num(attrs[k])) inf.errs.push(`${code(attrs[k])} isn't a number.`);
    if (attrs.step != null && attrs.step !== 'any' && !num(attrs.step)) inf.errs.push(`${code(attrs.step)} isn't a number. Write "in steps of 0.5", or "allowing decimals".`);
    for (const s of said) note(inf, s);
    return { attrs, rest };
  }

  function parseHtmlLine(s, inf) {
    let m;
    // groups: "... in group a" / "in groups a, b" / in group "main area" (main-area)
    let groups = [];
    const g = s.match(IN_GROUPS);
    if (g && !/"[^"]*\bin groups?\b[^"]*"$/.test(s)) { groups = groupsOf(g[1], inf); s = s.slice(0, g.index); }
    // a name: called save, called main area (two words become main-area), or called "helpToggle" (kept exactly)
    // (the name ends at a full stop or comma, or at a word that starts what it says: saying, says, reads, with …)
    const CALLED = /\s+(?:called|named)\s+("(?:[^"\\]|\\.)*"|[\w-]+(?:\s+(?!(?:saying|says|that|which|reads|reading|showing|shows|is|with|of|described|to)\b)[\w-]+)?)(?=[.,;:]|\s+(?:saying|says|that|which|reads|reading|showing|shows|is|with|of|described|to)\b|\s+["']|$)/i;
    const called = (t) => { const c = t.match(CALLED); return c ? nameOf(c[1]) : null; };
    const cut = (t) => t.replace(CALLED, '');
    // the text it shows: "…" on its own, or after saying, says, reads, that says, with the text … (and after its
    // name, if it has one: add a paragraph called intro. Its text reads "Hello" works too)
    const SAYS = /^[.,;:]?\s*(?:and\s+)?(?:(?:it|that|which|its|the)\s+)?(?:(?:paragraph|heading|title|button|label|item|link)\s+)?(?:text\s+)?(?:(?:that|which)\s+)?(?:says|saying|reads|reading|shows|showing|is|with(?:\s+the)?\s+(?:text|words))\s+(?=["'])/i;
    const textOf = (t) => strOf(cut(' ' + t).trim().replace(SAYS, ''));
    const el = (tag, extra = {}) => ({ tag, id: extra.id || null, groups, attrs: extra.attrs || {}, text: extra.text ?? null, container: !!extra.container });

    if ((m = s.match(/^(?:set the page title to|page title is|the page is called|title)\s+(.+)$/i))) {
      const t = strOf(m[1]); if (t == null) inf.errs.push('Put the title in quotes, like: page title is "My shop"');
      note(inf, 'The title shows in the browser tab and in search results.');
      return { title: t || '' };
    }
    if ((m = s.match(/^(?:page language is|the page is in)\s+([\w-]+)$/i))) return { lang: /^[a-z]{2}(?:-[a-z0-9]+)*$/i.test(m[1]) ? m[1] : m[1].toLowerCase().slice(0, 2) };
    if ((m = s.match(/^add\s+(?:a\s+|an\s+)?(big |small |)heading\s+(.+)$/i))) {
      const t = textOf(m[2]); if (t == null) inf.errs.push('Put the heading text in quotes, like: add a heading saying "Prices"');
      const tag = { 'big ': 'h1', 'small ': 'h3', '': 'h2' }[m[1].toLowerCase()];
      note(inf, `${code('<' + tag + '>')} is a heading. Use one big heading (h1) per page; screen readers and search engines use headings to understand the page.`);
      return el(tag, { text: t || '', id: called(' ' + m[2]) });
    }
    if ((m = s.match(/^add\s+(?:a\s+)?paragraph(\s+.+|[.,;:].*)$/i))) {
      const t = textOf(m[1]); if (t == null) inf.errs.push('Put the paragraph text in quotes, like: add a paragraph called intro saying "Hello"');
      return el('p', { text: t || '', id: called(' ' + m[1]) });
    }
    if ((m = s.match(/^add\s+text\s+(?:called|named)\s+("(?:[^"\\]|\\.)*"|[\w-]+)\s+(.+)$/i))) { const t = textOf(m[2]); if (t == null) inf.errs.push('Put the text in quotes.'); return el('span', { text: t || '', id: nameOf(m[1]) }); }
    if ((m = s.match(/^add\s+text\s+(.+)$/i))) return el('span', { text: textOf(m[1]) ?? m[1] });
    if ((m = s.match(/^add\s+(?:a\s+)?button(.*?)\s+(?:saying|(?:that |which )?(?:says|reads)|reading|showing|labelled|labeled|with(?: the)? text)\s+(.+)$/i))) {
      const t = strOf(m[2]); if (t == null) inf.errs.push('Put the button text in quotes.');
      const id = called(m[1] + ' ') || called(m[1]);
      if (!id) inf.warns.push('Give the button a name ("called save") so Styling and Mechanics can refer to it.');
      return el('button', { text: t || '', id, attrs: { type: 'button' } });
    }
    // (an address is said the way people write it: google.com is https://google.com, see address)
    const at = (t, kind) => { const a = address(t, kind); if (a.note) note(inf, a.note); return a.value; };
    if ((m = s.match(/^add\s+(?:a\s+)?link(.*?)\s+to\s+("[^"]*"|'[^']*')\s+(?:saying|showing)\s+(.+)$/i))) {
      const t = strOf(m[3]); if (t == null) inf.errs.push('Put the link text in quotes, like: add a link to "https://example.com" saying "Example"');
      return el('a', { text: t ?? '', id: called(m[1]), attrs: { href: at(strOf(m[2]), 'href') } });
    }
    // a link with other things in it, indented under it
    if ((m = s.match(/^add\s+(?:a\s+)?link(.*?)\s+to\s+("[^"]*"|'[^']*')$/i)) && !/\S/.test(cut(m[1]))) return el('a', { id: called(m[1]), attrs: { href: at(strOf(m[2]), 'href') }, container: true });
    // an address without quotes: google.com, /about, me@example.com are clearly one; anything else needs them
    if ((m = s.match(/^add\s+(?:a\s+)?link(.*?)\s+to\s+([^"'].*?)(?:\s+(?:saying|showing)\s+(.+))?$/i)) && !/\S/.test(cut(m[1]))) {
      const said = m[2].trim(), clear = /^\S+$/.test(said) && (/^(?:https?:\/\/|www\.|mailto:|tel:|[/#])/i.test(said) || WEB_ADDRESS.test(said) || EMAIL.test(said));
      const t = m[3] != null ? strOf(m[3]) : null;
      if (!clear) inf.errs.push(`Put the address in quotes, like: add a link to "${/^\S+$/.test(said) ? said : 'about.html'}" saying "${t ?? (m[3] != null ? m[3].trim() : 'About')}"`);
      else if (m[3] != null && t == null) inf.errs.push('Put the link text in quotes, like: add a link to "https://example.com" saying "Example"');
      else if (m[3] == null) return el('a', { id: called(m[1]), attrs: { href: at(said, 'href') }, container: true });
      return el('a', { text: t ?? '', id: called(m[1]), attrs: { href: clear ? at(said, 'href') : '' } });
    }
    if ((m = s.match(/^add\s+(?:a\s+)?(?:picture|image|photo)(.*?)\s+of\s+("[^"]*"|'[^']*')(?:\s+described as\s+(.+))?$/i))) {
      const alt = m[3] ? strOf(m[3]) : null;
      if (alt == null) inf.warns.push('Add "described as "…"" so people using screen readers know what the picture shows.');
      return el('img', { id: called(m[1]), attrs: { src: at(strOf(m[2]), 'src'), alt: alt ?? '' } });
    }
    if ((m = s.match(/^add\s+(?:a\s+|an\s+)?(big\s+)?(?:(text|number|password|email|date|time|search|colou?r)\s+)?(text\s+)?(box|field|input)\b(.*)$/i)) &&
        !(/^box$/i.test(m[4]) && !m[1] && !m[2] && !m[3] && !Object.keys(inputSettings(m[5], { errs: [], notes: [], warns: [] }).attrs).length)) {   // "add a box called amount" alone is a block
      m = [m[0], m[1], m[2], m[5]];
      const { attrs, rest } = inputSettings(m[3], inf);
      const id = called(rest);
      if (/\S/.test(cut(rest))) inf.errs.push(`I don't understand "${cut(rest).trim()}" here. A box can have: a name ("called amount"), with hint "…", allowing decimals, in steps of 5, from 1 to 10, with a number keypad.`);
      if (!id) inf.warns.push('Give the box a name ("called email") so Mechanics can read what was typed.');
      if (m[1]) return el('textarea', { id, attrs: attrs.placeholder != null ? { placeholder: attrs.placeholder } : {}, text: '' });
      const type = INPUTS[(m[2] || 'text').toLowerCase()] || 'text';
      if (type === 'time') note(inf, 'A time box (`type="time"`) lets people pick a time; its value is text like "07:30".');
      // a text box is the browser's own default, so it has no type: the page says exactly what the sentence says
      return el('input', { id, attrs: type === 'text' ? { ...attrs } : { type, ...attrs } });
    }
    if ((m = s.match(/^add\s+(?:a\s+)?slider\b(.*)$/i))) {
      const { attrs, rest } = inputSettings(m[1], inf);
      const id = called(rest);
      if (/\S/.test(cut(rest))) inf.errs.push(`I don't understand "${cut(rest).trim()}" here. Try: add a slider called volume from 0 to 100`);
      if (!id) inf.warns.push('Give the slider a name ("called volume") so Mechanics can read where it is.');
      note(inf, '`<input type="range">` is a slider. Its value is the number it is set to, as text; it goes from 0 to 100 unless it has a range.');
      return el('input', { id, attrs: { type: 'range', ...attrs } });
    }
    if ((m = s.match(/^add\s+(?:a\s+)?file picker\b(.*?)(?:\s+for\s+(?:a\s+|an\s+|any\s+|one\s+)?(several\s+|many\s+|multiple\s+)?(pictures?|photos?|images?|sounds?|songs?|audio|music|videos?|text files?|files?|"[^"]*"|'[^']*'))?$/i))) {
      const id = called(m[1]);
      if (/\S/.test(cut(m[1]))) inf.errs.push(`I don't understand "${cut(m[1]).trim()}" here. Try: add a file picker called photo-file for pictures`);
      if (!id) inf.warns.push('Give the file picker a name ("called photo-file") so Mechanics can read the file picked.');
      const kind = (m[3] || '').toLowerCase(), accept = strOf(m[3] || '') ?? PICKS[kind];
      const several = !!m[2];
      const attrs = { type: 'file', ...(accept ? { accept } : {}), ...(several ? { multiple: '' } : {}) };
      note(inf, '`<input type="file">` is a file picker: it opens the device\'s own chooser. Mechanics reads what was picked from its `files`; nothing is uploaded.' + (accept ? ` \`accept\` offers only ${code(accept)}.` : '') + (several ? ' `multiple` lets people pick several at once.' : ''));
      return el('input', { id, attrs });
    }
    if ((m = s.match(/^add\s+(?:a\s+)?(?:checkbox|tick box)(.*?)(?:\s+saying\s+(.+))?$/i))) {
      const id = called(m[1]);
      if (id) note(inf, `Mechanics can check it with "if ${id} is ticked", and tick it with "tick ${id}".`);
      return { tag: 'label', groups, attrs: {}, text: null, id: null, container: false, children: [el('input', { id, attrs: { type: 'checkbox' } })], after: strOf(m[2] || '') || '' };
    }
    if ((m = s.match(/^add\s+(?:a\s+)?(?:drop-?down(?: list)?|menu of choices)(.*?)\s+with\s+(.+)$/i))) {
      const opts = splitItems(m[2]).map(o => strOf(o) ?? o);
      return { ...el('select', { id: called(m[1]) }), children: opts.map(o => ({ tag: 'option', text: o, attrs: {}, groups: [], id: null })) };
    }
    if ((m = s.match(/^add\s+(?:a\s+)?(?:list )?item\s+(?:called|named)\s+("(?:[^"\\]|\\.)*"|[\w-]+)\s+(.+)$/i))) { const t = strOf(m[2]); if (t == null) inf.errs.push('Put the list item\'s text in quotes.'); return el('li', { text: t || '', id: nameOf(m[1]) }); }
    if ((m = s.match(/^add\s+(?:a\s+)?(?:list )?item\s+(.+)$/i))) return el('li', { text: strOf(m[1]) ?? m[1] });
    if ((m = s.match(/^add\s+(?:a\s+)?label\s+(?:called|named)\s+("(?:[^"\\]|\\.)*"|[\w-]+)\s+(.+?)(?:\s+for\s+([\w-]+))?$/i))) { const t = strOf(m[2]); if (t == null) inf.errs.push('Put the label\'s text in quotes.'); return el('label', { id: nameOf(m[1]), text: t || '', attrs: m[3] ? { for: toId(m[3]) } : {} }); }
    if ((m = s.match(/^add\s+(?:a\s+)?label\s+(.+?)(?:\s+for\s+([\w-]+))?$/i))) return el('label', { text: strOf(m[1]) ?? m[1], attrs: m[2] ? { for: toId(m[2]) } : {} });
    if ((m = s.match(/^add\s+(?:a\s+)?video(.*?)\s+of\s+("[^"]*")$/i))) return el('video', { id: called(m[1]), attrs: { src: at(strOf(m[2]), 'src'), controls: '' } });
    if ((m = s.match(/^add\s+(?:a\s+)?(?:drawing area|canvas)(.*?)(?:\s+(\d+)\s*(?:by|x)\s*(\d+))?$/i))) return el('canvas', { id: called(m[1]), attrs: m[2] ? { width: m[2], height: m[3] } : {} });
    if ((m = s.match(/^add\s+(?:a\s+|an\s+)?(?:data\s+)?(?:chart|graph|plot)(.*?)(?:\s+(\d+)\s*(?:by|x)\s*(\d+))?$/i)) && !/\S/.test(cut(m[1]))) {
      note(inf, 'A chart is drawn on a drawing area (`<canvas>`): Mechanics draws its bars and lines with "draw a rectangle …" and "draw a line …", or a chart library draws on it.');
      return el('canvas', { id: called(m[1]), attrs: m[2] ? { width: m[2], height: m[3] } : {} });
    }
    if ((m = s.match(/^add\s+(?:a\s+)?line$/i))) return el('hr');
    if ((m = s.match(/^add\s+(?:a\s+|an\s+)?(section|header|footer|navigation bar|navigation|nav|main area|main content|main|block|box|area|form|side panel|sidebar|article|card|numbered list|list|table|row|pop-up|dialog)\b(.*)$/i))) {
      const kind = m[1].toLowerCase();
      const tag = CONTAINERS[kind];
      const id = called(m[2]);
      if (kind === 'card' && !groups.includes('card')) groups.push('card');
      if (/\S/.test(cut(m[2]))) inf.errs.push(`I don't understand "${cut(m[2]).trim()}" here. Try: add a ${kind} called hero`);
      return el(tag, { id, container: true });
    }
    if ((m = s.match(/^(?:html|raw)\s*:\s?(.*)$/i))) return { raw: m[1] };
    return null;
  }

  /* One Structure line: text on its own ("…"), a sentence for a kind of element, or any element said the
     generic way, each with its attribute phrases after commas and its groups at the end. */
  function parseLine(s, inf, ctx) {
    let groupPart = '';
    const g = s.match(IN_GROUPS);
    if (g && !/"[^"]*\bin groups?\b[^"]*"$/.test(s)) { groupPart = g[0]; s = s.slice(0, g.index); }
    // a drawing's own settings are drawing settings (filled with, outlined in), as are those of everything in it
    const { rest, attrs, glued } = takePhrases(s, /^add\s+(?:a\s+)?drawing(?!\s+area)(?=[\s,]|$)/i.test(s) ? { ...ctx, svg: true } : ctx);
    let el = null;
    if (/^(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')$/.test(rest) && !groupPart) el = { textNode: strOf(rest) };
    else {
      const scratch = () => ({ notes: [], warns: [], errs: [] });
      const tries = [];
      const specific = () => { const x = scratch(); const e = parseHtmlLine(rest + groupPart, x); if (e) tries.push([e, x]); };
      const generic = () => {
        const x = scratch(); const e = genericElement(rest, x, ctx);
        if (e) { const gr = groupPart ? parseHtmlLine('add a block' + groupPart, x) : null; e.groups = gr ? gr.groups : []; tries.push([e, x]); }
      };
      if (ctx.svg) { generic(); specific(); } else { specific(); generic(); }
      const pick = tries.find(([, x]) => !x.errs.length) || tries[0];
      if (!pick) return null;
      el = pick[0];
      for (const k of ['notes', 'warns', 'errs']) for (const v of pick[1][k]) if (!inf[k].includes(v)) inf[k].push(v);
    }
    if (el.title != null || el.lang || el.raw != null) {
      if (attrs.length || glued) inf.errs.push('This line can\'t have the settings after its commas.');
      return el;
    }
    if (el.textNode != null) {
      if (attrs.length) inf.errs.push('Text on its own can\'t have settings: put it in an element ("add text "…", hidden from screen readers").');
    } else {
      el.attrs = { ...(el.attrs || {}) };
      for (const [k, v, said] of attrs) {
        if (said) note(inf, said);
        if (v == null) delete el.attrs[k];
        else if (k === 'id' && !el.id) {
          // an id can't have spaces in a page: "main display" is main-display, as "called main display" is
          el.id = /\s/.test(v.trim()) ? toId(v) : v;
          if (el.id !== v) note(inf, `An id can't have spaces in a page, so ${code(v)} is ${code(el.id)}. Styling and Mechanics can call it ${v.trim()} or ${el.id}.`);
        } else { delete el.attrs[k]; el.attrs[k] = v; }
        if (k === 'type') el.typeSaid = true;
        if (k === 'alt' && v == null) inf.warns = inf.warns.filter(w => !/described as/.test(w));
      }
      // a name given after a comma ("with id …") is a name too
      if (el.id) inf.warns = inf.warns.filter(w => !/^Give the [\w -]+ a name \("called /.test(w));
      if (el.tag && !VOID_TAGS.has(el.tag) && !/^(?:textarea|select)$/.test(el.tag) && !el.container && !el.children) el.container = true;   // anything can hold other things
    }
    if (glued) el.glued = true;
    if (el.tag === 'svg') el.svg = true;
    return el;
  }

  /* Raw HTML inside <pre>, <textarea>, <script> or <style> keeps its own spaces (the page shows or runs
     them exactly), so those lines aren't indented to fit. Which of them is still open after this line? */
  const KEEP_SPACES = /<(pre|textarea|script|style|listing|xmp)\b[^>]*>/gi;
  function rawOpen(line, open) {
    const low = line.toLowerCase();
    for (let i = 0; ;) {
      if (open) {
        const close = low.indexOf('</' + open, i);
        if (close < 0) return open;
        i = close + 2 + open.length; open = null;
      }
      KEEP_SPACES.lastIndex = i;
      const m = KEEP_SPACES.exec(line);
      if (!m) return null;
      open = m[1].toLowerCase(); i = m.index + m[0].length;
    }
  }
  // raw lines that take the place of what Structure writes itself (an attribute, never text inside another one's value)
  const STYLE_LINK = /<link\b(?:[^>"']|"[^"]*"|'[^']*')*?\shref\s*=\s*["']?style\.css["'\s>]/i, SCRIPT_TAG = /<script\b(?:[^>"']|"[^"]*"|'[^']*')*?\ssrc\s*=\s*["']?script\.js["'\s>]/i;
  const CHARSET_META = /<meta\b(?:[^>"']|"[^"]*"|'[^']*')*?\scharset\s*=/i, VIEWPORT_META = /<meta\b(?:[^>"']|"[^"]*"|'[^']*')*?\sname\s*=\s*["']?viewport["'\s>]/i;

  /* The project file an address on a page names ("styles.css?v=2", "../css/site.css"), from the page's path, in
     lower case (as the project compares paths); null for an address elsewhere (https://…, //cdn…, data:…). */
  function linkedFile(page, ref) {
    if (!ref || /^(?:[a-z][\w+.-]*:|\/\/)/i.test(ref)) return null;
    let p = ref.split(/[?#]/)[0];
    try { p = decodeURIComponent(p); } catch (_) { return null; }
    const parts = p.startsWith('/') ? [] : String(page).split('/').slice(0, -1);
    for (const seg of p.split('/')) { if (seg === '..') parts.pop(); else if (seg && seg !== '.') parts.push(seg); }
    return parts.join('/').toLowerCase() || null;
  }
  /* Does the page get the style.css link (kind 'css') or the script.js tag ('js') the writer adds? Yes when the
     project's main style sheet (script) is that file, or the page loads none of the project's own. Not for a page
     that loads its own by other names (imported, with styles.css?v=2 and app.js): those files aren't there.
     site: from compileWebsite; null (no paths): yes, as always. */
  function addsLink(kind, site, page) {
    if (!site) return true;
    const main = kind === 'css' ? site.styling : site.mechanics;
    if (main && linkedFile(site.page, kind === 'css' ? 'style.css' : 'script.js') === main.toLowerCase()) return true;
    // a bundled app's page (a Vite app's index.html, which loads /src/main.tsx as a module): its code brings in its
    // own styles and scripts
    const code = new Set(site.files.filter(f => /^(?:js|ts|tsx)$/.test(f.lang)).map(f => f.path.toLowerCase()));
    const scripts = page.replace(/<!--[\s\S]*?-->/g, '').match(/<script\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi) || [];
    if (scripts.some(t => {
      const m = t.match(/\ssrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
      return /\stype\s*=\s*(?:"module"|'module'|module\b)/i.test(t) && !!m && code.has(linkedFile(site.page, m[1] ?? m[2] ?? m[3]));
    })) return false;
    const own = new Set(site.files.filter(f => f.lang === kind).map(f => f.path.toLowerCase()));
    const tags = page.replace(/<!--[\s\S]*?-->/g, '').match(kind === 'css' ? /<link\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi : /<script\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi) || [];
    return !tags.some(t => {
      if (kind === 'css' && !/\srel\s*=\s*(?:"[^"]*\bstylesheet\b[^"]*"|'[^']*\bstylesheet\b[^']*'|stylesheet\b)/i.test(t)) return false;
      const m = t.match(kind === 'css' ? /\shref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i : /\ssrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
      return !!m && own.has(linkedFile(site.page, m[1] ?? m[2] ?? m[3]));
    });
  }

  // lines copied exactly (and notes), where curly quotes are left as they are
  const RAW_HTML = /^(?:(?:in the )?head|doctype|html|raw|note|comment|(?:the )?(?:page )?body (?:attributes|has)|(?:the )?html (?:tag )?attributes)\s*:/i;

  function compileHtml(sec, shared) {
    shared.elements = [];   // each element made: { tag, id, text, line }, so Styling and Mechanics can find one by its text
    const lines = sec.text.split('\n');
    const info = makeInfo(lines);
    // A whole page in exact lines, with its own <!doctype> or <html> (a Vite app's index.html, which its dev server
    // fills in): written as it is, with nothing added. Pages in sentences get the usual page around them.
    const exactOf = (l) => { const m = l.replace(/\r$/, '').match(/^([ \t]*)(?:html|raw)\s*:\s?(.*)$/i); return m ? m[1] + m[2] : null; };
    const filled = lines.filter(l => l.trim());
    if (filled.length && filled.every(l => exactOf(l) != null) && /^\s*<(?:!doctype|html)\b/i.test(exactOf(filled[0]))) {
      const out = lines.map((l, i) => (l.trim() ? { text: exactOf(l), src: i } : { text: '', src: -1 }));
      while (out.length && !out[out.length - 1].text) out.pop();
      out.forEach((o, idx) => { if (o.src >= 0) info[o.src].py.push(idx); });
      note(info[lines.indexOf(filled[0])], 'A whole page copied exactly (it has its own <html>), so it\'s written as it is, with nothing added.');
      const text = out.map(o => o.text).join('\n'), tm = text.match(/<title\b[^>]*>([^<]*)<\/title>/i);
      return { lines: out, info, text: text + '\n', title: tm ? tm[1].trim() : null };
    }
    const rootEl = { tag: 'body', children: [], container: true };
    const stack = [{ ind: -1, el: rootEl }];
    let title = 'My page', lang = 'en', bodyAttrs = '', htmlAttrs = '', doctype = '<!DOCTYPE html>', noCharset = false, noViewport = false, pageGroups = [];
    const head = [];
    const all = [];
    const at = {};   // the sentence line behind each part of the page outside <body>
    lines.forEach((raw, i) => {
      const inf = info[i];
      if (!raw.trim()) return;
      // curly quotes count as straight ones, except in HTML copied exactly
      if (!RAW_HTML.test(raw.trim())) { const st = straightQuotes(raw); if (st !== raw) { raw = st; note(inf, CURLY_NOTE); } }
      const ind = raw.match(/^ */)[0].length;
      const t = raw.trim(), exact = raw.replace(/^\s+|\r$/g, '');   // raw HTML keeps any spaces at its end
      let hm;
      if ((hm = exact.match(/^(?:in the )?head\s*:\s?(.*)$/i))) {
        head.push({ text: hm[1], src: i });
        note(inf, 'HTML copied exactly into the page\'s <head>: the part browsers read first (links, settings), not shown on the page.');
        if (CHARSET_META.test(hm[1])) note(inf, 'It replaces the usual `<meta charset="utf-8">`.');
        if (VIEWPORT_META.test(hm[1])) note(inf, 'It replaces the usual viewport setting.');
        if (STYLE_LINK.test(hm[1])) note(inf, 'This is where the page loads Styling (style.css), instead of at the end of <head>.');
        if (SCRIPT_TAG.test(hm[1])) note(inf, 'This is where the page loads Mechanics (script.js), instead of at the end of <body>.');
        return;
      }
      if ((hm = t.match(/^(?:the )?(?:page )?body (?:attributes|has)\s*:\s?(.*)$/i))) { bodyAttrs = hm[1].trim(); note(inf, 'Attributes copied exactly onto the page\'s <body> tag.'); inf.target = 'body'; return; }
      if ((hm = t.match(PAGE_GROUPS))) {
        pageGroups = groupsOf(hm[1], inf);
        for (const g of pageGroups) shared.groups[g] = true;
        note(inf, `The page's <body> is in ${pageGroups.length > 1 ? 'these groups' : 'this group'} (a class), so styles for ${pageGroups.length > 1 ? 'them' : 'it'} apply to the whole page.`);
        inf.target = 'body'; return;
      }
      if ((hm = t.match(/^(?:the )?html (?:tag )?attributes\s*:\s?(.*)$/i))) { htmlAttrs = hm[1].trim(); at.html = i; note(inf, 'Attributes copied exactly onto the page\'s <html> tag, which holds the whole page.'); return; }
      if (/^(?:no title|the page has no title)$/i.test(t)) { title = null; return; }
      if (/^(?:no page language|the page has no language)$/i.test(t)) { lang = null; at.html = at.html ?? i; note(inf, 'Leaves out `lang` on the <html> tag. With it, screen readers pronounce the page correctly and browsers can offer to translate it.'); return; }
      if (/^(?:no doctype|leave out the doctype)$/i.test(t)) { doctype = null; note(inf, 'Leaves out `<!DOCTYPE html>`. Without it, browsers draw the page in "quirks mode", the way very old pages were drawn.'); return; }
      if ((hm = exact.match(/^doctype\s*:\s?(.*)$/i))) { doctype = hm[1]; at.doctype = i; note(inf, 'The first line of the page, copied exactly: it tells the browser which kind of HTML this is.'); return; }
      if (/^leave out the character set$/i.test(t)) { noCharset = true; note(inf, 'Leaves out `<meta charset="utf-8">`, so the browser has to guess how the page\'s letters are stored (accents and symbols can come out wrong).'); return; }
      if (/^leave out the viewport(?: setting)?$/i.test(t)) { noViewport = true; note(inf, 'Leaves out the viewport setting, so phones show the page zoomed out, like on a big screen.'); return; }
      const rawLine = exact.match(/^(?:html|raw)\s*:\s?(.*)$/i);
      let s = rawLine ? exact : t.replace(/[.:]$/, '');
      if (/^(?:note|comment)\s*:/i.test(s)) {   // a note goes where its indentation puts it, like any line
        while (stack.length > 1 && ind <= stack[stack.length - 1].ind) stack.pop();
        stack[stack.length - 1].el.children.push({ comment: s.replace(/^(?:note|comment)\s*:\s*/i, ''), src: i });
        return;
      }
      const lead = s.match(FILLER);
      if (lead && lead[0].length < s.length) { note(inf, `Left out filler: "${lead[0].trim()}".`); s = s.slice(lead[0].length); }
      while (stack.length > 1 && ind <= stack[stack.length - 1].ind) stack.pop();
      const parent = stack[stack.length - 1];
      if (parent.el !== rootEl && !parent.el.container) inf.errs.push('This line is indented under something that can\'t hold other things. Only sections, blocks, lists, forms and similar can.');
      const ctx = { svg: !!parent.el.svg && parent.el.tag !== 'foreignObject' };
      const el = rawLine ? { raw: rawLine[1] } : parseLine(s, inf, ctx);
      if (!el) {
        const away = ELSEWHERE.map(([re, say]) => { const w = s.match(re); return w && say(w[1]); }).find(Boolean);
        inf.errs.push(away || 'I don\'t recognise this sentence. Open the Index (in Help) to see what Structure understands, or start the line with html: to write HTML directly.');
        return;
      }
      if (el.title != null) { title = el.title; inf.target = 'title'; return; }
      if (el.lang) { lang = el.lang; at.html = at.html ?? i; return; }
      el.src = i;
      // a name Styling or Mechanics gave it, by its text ("style "Welcome": …")
      if (!el.id && el.tag && shared.addIds && shared.addIds[i]) {
        el.id = shared.addIds[i];
        inf.warns = inf.warns.filter(w => !/^Give the [\w -]+ a name \("called /.test(w));
        note(inf, `Styling or Mechanics uses this by its text, so it's named ${code(el.id)} in the page.`);
      }
      if (el.tag && shared.elements) shared.elements.push({ tag: el.tag, id: el.id || null, text: el.text ?? null, line: i });
      for (const named of [el, ...(el.children || [])].filter(e => e.id)) {   // a checkbox's name is on the box inside its label
        if (shared.ids[named.id] && shared.ids[named.id].line !== i) inf.errs.push(`Another element is already called ${code(named.id)} (line ${shared.ids[named.id].line + 1}). Names must be unique on a page.`);
        else shared.ids[named.id] = { tag: named.tag, type: (named.attrs || {}).type || null, line: i };
        note(inf, `Named ${code(named.id)} (its HTML id). Styling and Mechanics can use this name.`);
      }
      for (const g of el.groups || []) { shared.groups[g] = true; note(inf, `In group ${code(g)} (an HTML class), so styles for that group apply to it.`); }
      if (el.tag === 'li' && !/^(ul|ol)$/.test(parent.el.tag)) inf.warns.push('List items belong inside a list. Indent this under "add a list".');
      if (el.tag === 'button' && parent.el.tag === 'form' && !el.typeSaid) { el.attrs.type = 'submit'; note(inf, 'Inside a form, this button sends the form (type="submit"). Handle it in Mechanics with "when … is sent".'); }
      parent.el.children.push(el);
      if (el.textNode == null) all.push(el);
      if (el.container) { el.children = el.children || []; stack.push({ ind, el }); }
    });
    // groups added from Styling ("save belongs to group primary")
    for (const [id, gs] of Object.entries(shared.addGroups)) {
      const el = all.find(e => e.id === id);
      if (el) for (const g of gs) if (!el.groups.includes(g)) el.groups.push(g);
    }
    // render
    const out = [];
    const push = (text, src) => out.push({ text, src });
    const raws = [...head.map(h => h.text), ...all.filter(e => e.raw != null).map(e => e.raw)];
    const inHead = (re) => head.some(h => re.test(h.text));
    if (doctype != null) push(doctype, at.doctype ?? -1);
    if (/(?:^|\s)lang\s*=/i.test(htmlAttrs)) lang = null;   // the attributes line says the language itself
    push(`<html${lang ? ` lang="${lang}"` : ''}${htmlAttrs ? ' ' + htmlAttrs : ''}>`, at.html ?? -1);
    push('<head>', -1);
    if (!noCharset && !inHead(CHARSET_META)) push('  <meta charset="utf-8">', -1);
    if (!noViewport && !inHead(VIEWPORT_META)) push('  <meta name="viewport" content="width=device-width, initial-scale=1">', -1);
    const ti = info.findIndex(x => x.target === 'title');
    if (title != null) push(`  <title>${esc(title)}</title>`, ti);
    let open = null;
    for (const h of head) { push(open ? h.text : '  ' + h.text, h.src); open = rawOpen(h.text, open); }
    const styleAt = out.length;   // Styling's link goes here, once the whole page is known (see addsLink)
    push('</head>', -1);
    push(`<body${pageGroups.length ? ` class="${pageGroups.join(' ')}"` : ''}${bodyAttrs ? ' ' + bodyAttrs : ''}>`, info.findIndex(x => x.target === 'body'));
    const attrs = (e) => {
      let a = '';
      if (e.id) a += ` id="${e.id}"`;
      if (shared.mark && e.src != null && e.src >= 0) a += ` data-ic-line="${e.src}"`;
      if (e.groups && e.groups.length) a += ` class="${e.groups.join(' ')}"`;
      for (const [k, v] of Object.entries(e.attrs || {})) a += v === '' && k !== 'alt' ? ` ${k}` : ` ${k}="${escAttr(v)}"`;
      return a;
    };
    open = null;
    const empty = (e) => (e.svg && !e.text ? `<${e.tag}${attrs(e)} />` : `<${e.tag}${attrs(e)}>${esc(e.text ?? '')}</${e.tag}>`);
    /* An inline element with text and other things in it goes on one line: a line break inside it would show
       as a space at its edges. Children are joined by a space, or by nothing when glued. null if it can't. */
    const oneLine = (e) => {
      if (e.comment != null) return `<!-- ${esc(e.comment)} -->`;
      if (e.raw != null) return rawOpen(e.raw, null) ? null : e.raw;
      if (e.textNode != null) return esc(e.textNode);
      if (VOID_TAGS.has(e.tag) && !e.svg) return `<${e.tag}${attrs(e)}>`;
      const kids = e.children || [];
      if (!kids.length) return empty(e);
      if (BLOCK_TAGS.test(e.tag) || e.after) return null;
      let inner = e.text ? esc(e.text) : '';
      for (const c of kids) { const s = oneLine({ ...c, src: c.src ?? e.src }); if (s == null) return null; inner += (inner && !c.glued ? ' ' : '') + s; }
      return `<${e.tag}${attrs(e)}>${inner}</${e.tag}>`;
    };
    const render = (e, depth) => {   // -> [{ text, src }]
      const pad = '  '.repeat(depth), one = (text) => [{ text: pad + text, src: e.src }];
      if (e.comment != null) return one(`<!-- ${esc(e.comment)} -->`);
      if (e.raw != null) { const keep = open; open = rawOpen(e.raw, open); return [{ text: keep ? e.raw : pad + e.raw, src: e.src }]; }
      if (e.textNode != null) return one(esc(e.textNode));
      if (VOID_TAGS.has(e.tag) && !e.svg) return one(`<${e.tag}${attrs(e)}>`);
      const kids = e.children || [];
      if (!(kids.length && (e.container || e.tag === 'label' || e.tag === 'select'))) return one(empty(e));
      if (!e.svg && !BLOCK_TAGS.test(e.tag) && !OWN_BOX_TAGS.test(e.tag) && !e.after) { const s = oneLine(e); if (s != null) return one(s); }
      const res = one(`<${e.tag}${attrs(e)}>`);
      if (e.text) res.push({ text: `${pad}  ${esc(e.text)}`, src: e.src });
      for (const c of kids) {
        const ls = render({ ...c, src: c.src ?? e.src }, depth + 1);
        if (c.glued) { res[res.length - 1] = { ...res[res.length - 1], text: res[res.length - 1].text + ls[0].text.replace(/^ +/, '') }; res.push(...ls.slice(1)); }
        else res.push(...ls);
      }
      if (e.after) res.push({ text: `${pad}  ${esc(e.after)}`, src: e.src });
      res.push({ text: `${pad}</${e.tag}>`, src: e.src });
      return res;
    };
    let lastTop = null;
    for (const c of rootEl.children) {
      const ls = render(c, 1);
      if (c.glued && lastTop) { out[out.length - 1].text += ls[0].text.replace(/^ +/, ''); ls.slice(1).forEach(l => push(l.text, l.src)); }
      else ls.forEach(l => push(l.text, l.src));
      lastTop = c;
    }
    // Styling's link and Mechanics' script, unless a head: or html: line places them. The preview always has them:
    // it puts Styling and Mechanics there (previewDocument)
    const page = out.map(o => o.text).join('\n');
    const adds = (kind) => shared.mark || addsLink(kind, shared.site, page);
    if (!raws.some(r => SCRIPT_TAG.test(r)) && adds('js')) push('  <script src="script.js"></script>', -1);
    push('</body>', -1);
    push('</html>', -1);
    if (!raws.some(r => STYLE_LINK.test(r)) && adds('css')) out.splice(styleAt, 0, { text: '  <link rel="stylesheet" href="style.css">', src: -1 });
    out.forEach((o, idx) => { if (o.src >= 0) info[o.src].py.push(idx); });
    return { lines: out, info, text: out.map(o => o.text).join('\n') + '\n', title };
  }

  /* ================================================================== */
  /* CSS: Styling                                                        */
  /* ================================================================== */

  // every colour CSS names (148, with the grey spellings), and transparent
  const NAMED = new Set(('aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue ' +
    'chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta ' +
    'darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink ' +
    'deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray grey green greenyellow ' +
    'honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow ' +
    'lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime ' +
    'limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen ' +
    'mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid ' +
    'palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue ' +
    'saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle ' +
    'tomato turquoise violet wheat white whitesmoke yellow yellowgreen transparent').split(' '));
  // the colours a shade is named after: "navy blue" is navy, a shade of blue; "red orange" is between two, so it's asked
  const HUES = new Set(['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'brown', 'grey', 'gray', 'black', 'white', 'violet']);
  // colours people say that CSS has no name for, and the names nearest them
  const NEAR = { lightred: 'lightcoral or salmon', lightorange: 'lightsalmon or peachpuff', lightpurple: 'plum or thistle', lightbrown: 'tan or burlywood', lightviolet: 'plum or violet',
    darkyellow: 'goldenrod or darkgoldenrod', darkpink: 'deeppink or mediumvioletred', darkpurple: 'indigo or rebeccapurple', darkbrown: 'saddlebrown or sienna', darkwhite: 'gainsboro or lightgray',
    bluegreen: 'teal or lightseagreen', greenblue: 'teal or cadetblue', babyblue: 'lightblue or powderblue', babypink: 'pink or lightpink', mintgreen: 'palegreen or mediumaquamarine', mint: 'mintcream or palegreen',
    peach: 'peachpuff or lightsalmon', cream: 'cornsilk or ivory', lilac: 'plum or thistle', mauve: 'plum or thistle', burgundy: 'maroon or darkred', rose: 'mistyrose or palevioletred', sand: 'sandybrown or wheat' };
  const isColourWord = (t) => NAMED.has(String(t).toLowerCase().replace(/[\s-]+/g, ''));
  const TAG_WORDS = { buttons: 'button', button: 'button', headings: 'h1, h2, h3', heading: 'h1, h2, h3', 'big headings': 'h1', 'big heading': 'h1', 'small headings': 'h3', 'small heading': 'h3', image: 'img', 'text box': 'input, textarea', list: 'ul, ol', 'list item': 'li', blocks: 'div', block: 'div', boxes: 'div', 'drop-downs': 'select', 'drop-down': 'select', links: 'a', link: 'a', paragraphs: 'p', paragraph: 'p', pictures: 'img', images: 'img', 'text boxes': 'input, textarea', inputs: 'input', lists: 'ul, ol', 'list items': 'li', sections: 'section', 'the page': 'body', page: 'body', everything: '*', header: 'header', footer: 'footer', 'navigation bar': 'nav', forms: 'form', labels: 'label' };
  const CSS_MORE = 'accent-color align-content all animation-delay animation-direction animation-duration animation-fill-mode animation-iteration-count animation-name animation-timing-function appearance backface-visibility background-attachment background-blend-mode background-clip background-origin background-repeat block-size border-bottom-color border-bottom-left-radius border-bottom-right-radius border-bottom-style border-bottom-width border-collapse border-image border-left-color border-left-style border-left-width border-right-color border-right-style border-right-width border-spacing border-style border-top-color border-top-left-radius border-top-right-radius border-top-style border-top-width border-width caption-side caret-color clear clip-path color-scheme column-count column-gap columns content counter-increment counter-reset direction empty-cells fill flex-basis flex-flow flex-grow flex-shrink float font-feature-settings font-variant font-variant-numeric grid grid-area grid-auto-columns grid-auto-flow grid-auto-rows grid-column grid-column-end grid-column-start grid-gap grid-row grid-row-end grid-row-start grid-template grid-template-areas hyphens image-rendering inline-size inset isolation justify-items justify-self list-style-image list-style-position list-style-type margin-block margin-inline mask max-block-size max-inline-size min-block-size min-inline-size mix-blend-mode object-position order outline-color outline-offset outline-style outline-width overflow-wrap overflow-x overflow-y overscroll-behavior padding-block padding-inline perspective place-content place-items place-self pointer-events quotes resize rotate row-gap scale scroll-behavior scroll-margin scroll-padding scroll-snap-align scroll-snap-type scrollbar-color scrollbar-width stroke stroke-width tab-size table-layout text-align-last text-decoration-color text-decoration-line text-decoration-style text-decoration-thickness text-indent text-overflow text-rendering text-shadow text-underline-offset touch-action transform-origin transition-delay transition-duration transition-property transition-timing-function translate user-select vertical-align will-change word-break word-spacing word-wrap writing-mode'.split(' ');
  const HTML_TAGS = new Set('a abbr address article aside audio b blockquote body button canvas caption code dd details dialog div dl dt em fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 header hr html i iframe img input kbd label legend li main mark menu nav ol optgroup option output p picture pre progress q s section select small span strong sub summary sup svg table tbody td textarea tfoot th thead time tr u ul video'.split(' '));
  const CSS_PROPS = new Set([...CSS_MORE, 'align-items', 'align-self', 'animation', 'aspect-ratio', 'background', 'background-color', 'background-image', 'background-position', 'background-size', 'border', 'border-bottom', 'border-color', 'border-left', 'border-radius', 'border-right', 'border-top', 'bottom', 'box-shadow', 'box-sizing', 'color', 'cursor', 'display', 'flex', 'flex-direction', 'flex-wrap', 'font', 'font-family', 'font-size', 'font-style', 'font-weight', 'gap', 'grid-template-columns', 'grid-template-rows', 'height', 'justify-content', 'left', 'letter-spacing', 'line-height', 'list-style', 'margin', 'margin-bottom', 'margin-left', 'margin-right', 'margin-top', 'max-height', 'max-width', 'min-height', 'min-width', 'object-fit', 'opacity', 'outline', 'overflow', 'padding', 'padding-bottom', 'padding-left', 'padding-right', 'padding-top', 'position', 'right', 'text-align', 'text-decoration', 'text-transform', 'top', 'transform', 'transition', 'visibility', 'white-space', 'width', 'z-index', 'filter', 'backdrop-filter']);
  const isCssProp = (p) => CSS_PROPS.has(p) || /^-(?:webkit|moz|ms)-[a-z-]+$/.test(p) || /^--[a-z0-9-]+$/.test(p);

  function color(v, inf) {
    v = v.trim();
    // a shared colour: "the colour main", "the colour main blue" (--main-blue)
    const mv = v.match(/^(?:the colou?r|shared colou?r)\s+([\w-]+(?:\s+[\w-]+)*)$/i);
    if (mv) return `var(--${toId(mv[1])})`;
    if (/^#/.test(v)) {
      if (!/^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v)) {
        inf.errs.push(`${code(v)} isn't a colour code. Hex colours use only 0-9 and a-f, with 3 or 6 of them after the #, like #1a2b3c.`);
        return v;
      }
      return v.toLowerCase();
    }
    if (/^(rgb|rgba|hsl|hsla)\(/i.test(v) || /^var\(/.test(v)) return v;
    // "rgb 255 0 0", "rgba 0, 0, 0, 0.5": the numbers go in brackets
    const fn = v.match(/^(rgba?|hsla?)\s+(-?[\d.]+(?:%|deg)?(?:\s*,\s*|\s+)-?[\d.]+%?(?:\s*,\s*|\s+)-?[\d.]+%?(?:(?:\s*,\s*|\s+)[\d.]+%?)?)$/i);
    if (fn) {
      const out = `${fn[1].toLowerCase()}(${fn[2].split(/\s*,\s*|\s+/).join(', ')})`;
      note(inf, `${code(v)} is written ${code(out)} in CSS.`);
      return out;
    }
    const words = v.toLowerCase().split(/[\s-]+/), w = words.join('');
    if (/^(?:currentcolou?r|thetextcolou?r|thesamecolou?rasthetext)$/.test(w)) { note(inf, '`currentColor` is the element\'s own text colour, so this follows it.'); return 'currentColor'; }
    if (/^(?:inherit|initial|unset|revert)$/.test(w)) { if (w === 'inherit') note(inf, '`inherit` takes the colour from the element around it.'); return w; }
    const gray = (t) => t.replace('grey', 'gray');
    if (NAMED.has(w)) {
      if (words.length > 1) note(inf, `CSS colour names are one word, so ${code(v)} is ${code(gray(w))}.`);
      return gray(w);
    }
    // a colour code without its #: fff, 1a2b3c (one with a digit, or one letter over and over, never a word like "bad")
    if (/^(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(v) && (/\d/.test(v) || /^(.)\1+$/.test(v))) {
      note(inf, `A colour code starts with #, so ${code(v)} is ${code('#' + v.toLowerCase())}.`);
      return '#' + v.toLowerCase();
    }
    // "navy blue": a shade CSS names (navy), then the colour it's a shade of
    if (words.length === 2 && NAMED.has(words[0]) && !HUES.has(words[0]) && HUES.has(words[1])) {
      note(inf, `CSS has no colour called ${code(w)}, so this is ${code(gray(words[0]))}, a shade of ${words[1]}.`);
      return gray(words[0]);
    }
    // not a colour: the names CSS has with those words in them, if there are a few
    const pool = [...NAMED].filter(n => n !== 'transparent' && !/grey/.test(n)), has = (ws) => pool.filter(n => ws.every(x => n.includes(gray(x))));
    const both = words.length > 1 ? has(words) : [], last = has(words.slice(-1)), pick = both.length ? both : last.length <= 6 ? last : [];
    const near = NEAR[w] || (pick.length && pick.length <= 6 ? pick.join(', ') : null);
    inf.errs.push(`I don't know the colour ${code(v)}.` + (near ? ` CSS has ${near}.` : '') + (/^[0-9a-f]{3,8}$/i.test(v) ? ` For a colour code, put # first: #${v}.` : ' Use a name like navy, or a code like #1a2b3c.'));
    return v;
  }
  /* A size: a number (pixels), or a number and a unit: 20px, 50%, 2em. A unit said as a word is its CSS unit
     ("50 percent" is 50%, "20 pixels" is 20px), and goes right after the number. */
  const UNIT_WORDS = { percent: '%', 'per cent': '%', percentage: '%', pixel: 'px', pixels: 'px', point: 'pt', points: 'pt', ems: 'em', rems: 'rem' };
  const CSS_UNITS = /^(?:px|%|em|rem|pt|pc|vw|vh|vmin|vmax|svh|lvh|dvh|svw|lvw|dvw|ch|ex|cm|mm|q|fr|deg|turn|s|ms)$/i;
  const unitOf = (w) => { const l = String(w).toLowerCase().replace(/\s+/g, ' '); return UNIT_WORDS[l] || (CSS_UNITS.test(l) ? l : null); };
  function unit(v, inf) {
    const t = v.trim();
    if (/^-?\d+(\.\d+)?$/.test(t)) return t === '0' ? '0' : (note(inf, 'Numbers without a unit are taken as pixels (px).'), t + 'px');
    const m = t.match(/^(-?(?:\d+(?:\.\d+)?|\.\d+))\s*([a-z%]+(?:\s+cent)?)$/i);
    if (!m) return t;
    const u = unitOf(m[2]);
    if (!u) { inf.errs.push(`${code(m[2])} isn't a size CSS knows. After a number, write px (pixels), % (percent), em or rem, like ${m[1]}px.`); return t; }
    const out = m[1] + u;
    if (out !== t) note(inf, `${code(t)} is written ${code(out)} in CSS.`);
    return out;
  }
  /* Sizes one after another ("space inside 10 20", "10 pixels 20 pixels"): each one a size, a number's unit word
     kept with it. Other words (auto) stay as they are. */
  function sizes(text, inf) {
    const ws = String(text).trim().split(/\s+/), out = [];
    for (let k = 0; k < ws.length; k++) {
      const n = /^-?(?:\d+(?:\.\d+)?|\.\d+)$/.test(ws[k]);
      if (n && /^per$/i.test(ws[k + 1] || '') && /^cent$/i.test(ws[k + 2] || '')) { out.push(unit(ws.slice(k, k + 3).join(' '), inf)); k += 2; }
      else if (n && ws[k + 1] && /^(?:[a-z]+|%)$/i.test(ws[k + 1]) && !/^(?:auto|inherit|initial|unset|revert|none)$/i.test(ws[k + 1])) { out.push(unit(ws[k] + ' ' + ws[k + 1], inf)); k++; }
      else out.push(unit(ws[k], inf));
    }
    return out.join(' ');
  }
  /* A size where only some words are CSS's own: "text size big" or "width full" would be dropped by the browser,
     so they're problems that say what to write. */
  const SIZE_WORDS = {
    'font-size': [/^(?:xx-small|x-small|small|medium|large|x-large|xx-large|xxx-large|smaller|larger|math)$/i, 'a text size', 'a number (20 is 20px), or small, medium, large or x-large'],
    length: [/^(?:auto|fit-content|min-content|max-content|stretch|none)$/i, 'a size', 'a number (200 is 200px), a share like 100% (of what it\'s in), or auto'],
  };
  function sizeOf(v, inf, kind) {
    const out = unit(v, inf), w = out.trim();
    const [ok, what, use] = SIZE_WORDS[kind] || SIZE_WORDS.length;
    if (/^[a-z][a-z-]*$/i.test(w) && !ok.test(w) && !/^(?:inherit|initial|unset|revert|revert-layer)$/i.test(w)) inf.errs.push(`${code(w)} isn't ${what} CSS knows. Write ${use}.`);
    return out;
  }
  function withAlpha(c, pct) {
    const h = c.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (!h) return null;
    let x = h[1]; if (x.length === 3) x = x.split('').map(d => d + d).join('');
    return `rgba(${parseInt(x.slice(0, 2), 16)}, ${parseInt(x.slice(2, 4), 16)}, ${parseInt(x.slice(4, 6), 16)}, ${+(1 - pct / 100).toFixed(2)})`;
  }

  /* Plain CSS properties that take a single value: a second one is usually another style that lost its
   * comma ("line-height: 1.1 #000000"), which the browser would otherwise drop without a word. */
  const ONE_VALUE = new Set(['line-height', 'opacity', 'z-index', 'font-weight', 'font-size', 'font-style', 'letter-spacing', 'word-spacing', 'width', 'height', 'max-width', 'min-width', 'max-height', 'min-height', 'color', 'background-color', 'text-align', 'text-transform', 'position', 'cursor', 'visibility', 'top', 'left', 'right', 'bottom', 'order', 'flex-grow', 'flex-shrink', 'accent-color', 'caret-color']);
  function checkRaw(prop, value, inf) {
    if (!ONE_VALUE.has(prop) || /[(!/]/.test(value)) return;
    const parts = value.trim().split(/\s+/);
    if (parts.length < 2) return;
    const colourish = /^#[0-9a-f]{3,8}$/i.test(parts[1]) || NAMED.has(parts[1].toLowerCase());
    inf.warns.push(`${code(prop)} takes one value, and this has ${parts.length}: ${code(value.trim())}. ` + (colourish
      ? `${code(parts[1])} looks like a colour: give it its own style after a comma, like "${prop}: ${parts[0]}, text colour ${parts[1]}" (or "background ${parts[1]}").`
      : `If ${code(parts.slice(1).join(' '))} is another style, separate it with a comma.`));
  }
  /* CSS properties whose value can be a list with commas ("transition: opacity 0.4s, transform 0.4s"), and
     what a part after a comma looks like when it carries on that list rather than starting a new style:
     a number, quoted text, a colour code or something in brackets, "name 0.4s", or one plain word that
     isn't a style of its own ("font-family: Georgia, serif"). */
  const COMMA_LISTS = new Set(['transition', 'transition-property', 'transition-duration', 'transition-timing-function', 'transition-delay', 'animation', 'animation-name', 'animation-duration', 'animation-timing-function', 'animation-delay', 'box-shadow', 'text-shadow', 'font-family', 'background', 'background-image', 'background-position', 'background-size', 'background-repeat', 'grid-template-areas', 'will-change', 'mask', 'mask-image', 'font-feature-settings', 'font-variation-settings', 'cursor', 'src']);
  const ONE_WORD_STYLES = /^(?:bold|italic|capitals|uppercase|hidden|centred|centered|round|circle|circular|smooth|stacked|fixed|shadow)$/i;
  // (a style phrase after the list, like "background var(--x)", starts a new style even though it has brackets)
  const STARTS_STYLE = /^(?:background|text colou?r|colou?r|text size|font size|font|space inside|space around|padding|margin|rounded corners|border|outline|(?:top|bottom|left|right) border|width|height|gap|at most|at least)\s/i;
  const carriesOn = (part) => !/^-{0,2}[a-z][a-z0-9-]*\s*:\s/i.test(part) && !/^\d+%\s+(?:see-through|transparent)$/i.test(part) &&
    (/^[a-z-]+\s+-?[\d.]+m?s\b/i.test(part) || (!STARTS_STYLE.test(part) && (/^[-\d.#"']|\(|^inset\b/i.test(part) || (/^[\w-]+$/.test(part) && !ONE_WORD_STYLES.test(part)))));

  /* A border or outline's words, in any order: a width (2, 2px, thin…), a line style (dashed…) and a colour.
     Left out: 1px, solid, the text colour. "none" alone is no border. */
  const LINE_STYLES = /^(?:solid|dashed|dotted|double|groove|ridge|inset|outset|none|hidden)$/i;
  function borderValue(text, inf) {
    const words = [];
    let depth = 0, cur = '';
    for (const c of text.trim()) {   // split at spaces outside brackets: rgba(0, 0, 0, .5) is one word
      if (c === '(') depth++; else if (c === ')') depth--;
      if (/\s/.test(c) && !depth) { if (cur) words.push(cur); cur = ''; } else cur += c;
    }
    if (cur) words.push(cur);
    // a width's unit said as a word stays with it: "2 pixels dashed red" is 2px
    for (let k = 0; k < words.length - 1; k++) if (/^-?[\d.]+$/.test(words[k]) && unitOf(words[k + 1])) words.splice(k, 2, words[k] + ' ' + words[k + 1]);
    let width = null, style = null;
    const rest = [];
    for (const w of words) {
      const isWidth = /^(?:thin|medium|thick)$/i.test(w) || (/\d/.test(w) && (/^-?[\d.]+(?:px|em|rem|%)?$/i.test(w) || (/^-?[\d.]+\s+\S+$/.test(w) && unitOf(w.split(/\s+/)[1]))));
      if (width == null && isWidth) width = /^[a-z]+$/i.test(w) ? w.toLowerCase() : unit(w, inf);
      else if (style == null && LINE_STYLES.test(w)) style = w.toLowerCase();
      else rest.push(w);
    }
    if (style === 'none' && width == null && !rest.length) return 'none';
    return `${width || '1px'} ${style || 'solid'} ${rest.length ? color(rest.join(' '), inf) : 'currentColor'}`;
  }

  /* "background navy, rounded corners 8, shadow" -> [[prop, value], ...] */
  function cssProps(text, inf) {
    const out = [], parts = [];
    for (const part of splitItems(outsideQuotes(text, (t) => t.replace(/\s+and\s+(?=[a-z])/gi, ', ')))) {
      const prev = parts[parts.length - 1], pm = prev && prev.match(/^(-{0,2}[a-z][a-z0-9-]*)\s*:\s/i);
      if (pm && COMMA_LISTS.has(pm[1].toLowerCase()) && carriesOn(part.trim())) {
        parts[parts.length - 1] = prev.replace(/\.$/, '') + ', ' + part.trim();
        note(inf, `The commas after ${code(pm[1].toLowerCase() + ':')} are part of its value: ${code(pm[1].toLowerCase())} takes a list.`);
      } else if (prev && /\b(?:rgba?|hsla?)\s+-?[\d.]+(?:%|deg)?(?:\s*,\s*-?[\d.]+%?)*$/i.test(prev) && /^-?[\d.]+%?$/.test(part.trim())) {
        parts[parts.length - 1] = prev + ', ' + part.trim();   // "background rgb 255, 0, 0": one colour, not three styles
      } else parts.push(part);
    }
    for (let part of parts) {
      part = part.trim().replace(/\.$/, '');
      let m;
      if ((m = part.match(/^(-{0,2}[a-z][a-z0-9-]*)\s*:\s+(.+)$/i)) && isCssProp(m[1].toLowerCase())) { out.push([m[1].toLowerCase(), m[2].trim()]); checkRaw(m[1].toLowerCase(), m[2], inf); note(inf, `${code(m[1])} is written as plain CSS.`); continue; }
      if ((m = part.match(/^background (?:a )?gradient(?:\s+at\s+(-?\d+(?:\.\d+)?deg))?\s+from\s+(.+?)((?:\s+through\s+.+?)*)\s+to\s+(.+)$/i))) {   // "background gradient from #fff3e0 to #ffe0b2"
        const cs = [m[2], ...m[3].split(/\s+through\s+/i).filter(s => s.trim()), m[4]].map(c => color(c.trim(), inf));
        out.push(['background', `linear-gradient(${m[1] ? m[1] + ', ' : ''}${cs.join(', ')})`]); continue;
      }
      if ((m = part.match(/^(?:background|background colou?r)\s+(.+?)(?:\s+(\d+)%\s+(?:see-through|transparent))?$/i))) {
        const pic = m[1].match(/^picture\s+(.+)$/i);
        if (pic) { out.push(['background-image', `url(${pic[1].trim()})`], ['background-size', 'cover']); continue; }
        const c = color(m[1], inf);
        if (m[2]) {
          const a = withAlpha(c, +m[2]);
          note(inf, `A see-through background uses an rgba colour, so only the background fades, not the text inside. (${m[2]}% see-through = ${1 - m[2] / 100} opacity.)`);
          out.push(['background', a || c]); continue;
        }
        out.push(['background', c]); continue;
      }
      if ((m = part.match(/^(?:text colou?r|colou?r|text)\s+(.+)$/i)) && !/^(size|centred|centered|bold|weight|aligned)\b/i.test(m[1])) { out.push(['color', color(m[1], inf)]); continue; }
      if ((m = part.match(/^(?:text size|font size|size of text)\s+(.+)$/i))) { out.push(['font-size', sizeOf(m[1], inf, 'font-size')]); continue; }
      if (/^bold( text)?$/i.test(part)) { out.push(['font-weight', 'bold']); continue; }
      if (/^italic( text)?$/i.test(part)) { out.push(['font-style', 'italic']); continue; }
      if (/^(?:capitals|all capitals|uppercase)( text)?$/i.test(part)) { out.push(['text-transform', 'uppercase']); continue; }
      if ((m = part.match(/^font\s+(.+?)\s+or any (serif|sans-serif|monospace|cursive) font$/i))) { const f = m[1].replace(/^["']|["']$/g, ''); out.push(['font-family', `"${f}", ${m[2].toLowerCase()}`]); continue; }
      if ((m = part.match(/^(?:text|font) weight\s+(\d{3}|normal|bold|bolder|lighter)$/i))) { out.push(['font-weight', m[1].toLowerCase()]); continue; }
      if ((m = part.match(/^line height\s+(\S+|-?[\d.]+\s+[a-z]+(?:\s+cent)?)$/i))) { out.push(['line-height', /^\S+$/.test(m[1]) ? m[1] : unit(m[1], inf)]); note(inf, 'A line height without a unit is that many times the text size.'); continue; }
      if ((m = part.match(/^letter spacing\s+(\S+|-?[\d.]+\s+[a-z]+)$/i))) { out.push(['letter-spacing', unit(m[1], inf)]); continue; }
      if ((m = part.match(/^text aligned (left|right|center|centre|justify|start|end)$/i))) { out.push(['text-align', m[1].toLowerCase().replace('centre', 'center')]); continue; }
      if (/^underlined( text)?$/i.test(part)) { out.push(['text-decoration', 'underline']); continue; }
      if (/^(?:struck through|crossed out)( text)?$/i.test(part)) { out.push(['text-decoration', 'line-through']); continue; }
      if (/^(?:its )?size includes (?:the |its )?padding plus border$/i.test(part)) { out.push(['box-sizing', 'border-box']); note(inf, '`box-sizing: border-box`: the width and height include the space inside and the border, so they are the size you see.'); continue; }
      if ((m = part.match(/^font\s+(.+)$/i))) { const f = m[1].replace(/^["']|["']$/g, ''); out.push(['font-family', `"${f}", sans-serif`]); continue; }
      if ((m = part.match(/^(?:space inside|padding|inner space)\s+(.+)$/i))) { out.push(['padding', sizes(m[1], inf)]); continue; }
      if ((m = part.match(/^(?:space around|margin|outer space)\s+(.+)$/i))) { out.push(['margin', sizes(m[1], inf)]); continue; }
      if (/^(?:centred|centered|in the middle)$/i.test(part)) { out.push(['margin-left', 'auto'], ['margin-right', 'auto']); note(inf, 'Centring a block uses automatic space on its left and right. It needs a width or max-width to have an effect.'); continue; }
      if (/^(?:centre|center) the text|^(?:centred|centered) text$/i.test(part)) { out.push(['text-align', 'center']); continue; }
      if ((m = part.match(/^rounded corners?(?:\s+(.+))?$/i))) { out.push(['border-radius', m[1] ? sizes(m[1], inf) : '8px']); continue; }
      if (/^(?:round|circle|circular)$/i.test(part)) { out.push(['border-radius', '50%']); continue; }
      if ((m = part.match(/^no (border|outline)$/i))) { out.push([m[1].toLowerCase(), 'none']); continue; }
      if ((m = part.match(/^(?:(top|bottom|left|right) )?(border|outline)(?:\s+(.+))?$/i)) && !(m[1] && /^outline$/i.test(m[2]))) {
        // "border 2 dashed red", "border dashed red", "border red" (1px, solid), "border 3"; "bottom border 1 #ccc"
        const prop = m[2].toLowerCase() + (m[1] ? '-' + m[1].toLowerCase() : '');
        out.push([prop, borderValue(m[3] || '', inf)]);
        continue;
      }
      if (/^no shadow$/i.test(part)) { out.push(['box-shadow', 'none']); continue; }
      if ((m = part.match(/^(soft |big |strong |)shadow(?:\s+(.+?))?(?:\s+with\s+(\d+)%\s+(?:intensity|strength))?$/i))) {
        const size = { 'soft ': '0 2px 8px', 'big ': '0 12px 32px', 'strong ': '0 6px 18px', '': '0 4px 12px' }[m[1].toLowerCase()];
        let c = m[2] ? color(m[2], inf) : 'rgba(0, 0, 0, 0.25)';
        if (m[3] && /^#/.test(c)) c = withAlpha(c, 100 - +m[3]) || c;
        out.push(['box-shadow', `${size} ${c}`]); note(inf, 'A box shadow: sideways offset, downwards offset, blur, then colour.'); continue;
      }
      if ((m = part.match(/^(\d+)%\s+(?:see-through|transparent)$/i))) {
        out.push(['opacity', String(+(1 - m[1] / 100).toFixed(2))]);
        note(inf, '`opacity` fades the whole element, including its text and everything inside. To fade only the background, write "background #123456 40% see-through".');
        continue;
      }
      if (/^hidden$/i.test(part)) { out.push(['display', 'none']); continue; }
      if ((m = part.match(/^(width|height)\s+(.+)$/i))) { out.push([m[1].toLowerCase(), sizeOf(m[2], inf)]); continue; }
      if ((m = part.match(/^at most\s+(.+?)\s+wide$/i))) { out.push(['max-width', sizeOf(m[1], inf)]); continue; }
      if ((m = part.match(/^at least\s+(.+?)\s+tall$/i))) { out.push(['min-height', sizeOf(m[1], inf)]); continue; }
      if (/^(?:in a row|side by side)$/i.test(part)) { out.push(['display', 'flex'], ['align-items', 'center']); note(inf, '`display: flex` lines the contents up in a row. It adapts to screen size, unlike fixed positions.'); continue; }
      if (/^(?:in a column|stacked)$/i.test(part)) { out.push(['display', 'flex'], ['flex-direction', 'column']); continue; }
      if ((m = part.match(/^in a grid of (\d+) columns?$/i))) { out.push(['display', 'grid'], ['grid-template-columns', `repeat(${m[1]}, 1fr)`]); continue; }
      if ((m = part.match(/^(?:gap|space between)\s+(.+)$/i))) { out.push(['gap', sizes(m[1], inf)]); continue; }
      if (/^spread out$/i.test(part)) { out.push(['justify-content', 'space-between']); continue; }
      if (/^(?:hand cursor|clickable cursor|looks clickable)$/i.test(part)) { out.push(['cursor', 'pointer']); continue; }
      if (/^(?:smooth changes|smooth|animated changes)$/i.test(part)) { out.push(['transition', 'all 0.2s ease']); continue; }
      if (/^(?:no underline)$/i.test(part)) { out.push(['text-decoration', 'none']); continue; }
      if ((m = part.match(/^(?:stays in place|fixed)$/i))) { out.push(['position', 'sticky'], ['top', '0']); note(inf, '`position: sticky` keeps it in view while scrolling past.'); continue; }
      if ((m = part.match(/^(?:at|placed at)\s+(\d+)\s*,\s*(\d+)$/i))) {
        out.push(['position', 'absolute'], ['left', m[1] + 'px'], ['top', m[2] + 'px']);
        inf.warns.push('An exact position can overlap other things and break on smaller screens. "in a row", "in a column" or a grid adapt better.');
        continue;
      }
      if ((m = part.match(/^(-?[a-z-]+)\s*:?\s+(.+)$/i)) && isCssProp(m[1].toLowerCase())) { out.push([m[1].toLowerCase(), m[2].trim()]); checkRaw(m[1].toLowerCase(), m[2], inf); note(inf, `${code(m[1])} is written as plain CSS.`); continue; }
      inf.errs.push(`I don't know the style "${part}". Open the Index (in Help) for style words, or write a CSS property like "letter-spacing 2px".`);
    }
    return out;
  }

  /* An element by the text it shows: "The Quote Is Sinking", or the big heading "The Quote Is Sinking". One
     with no name is given one in the page (from its text), so Styling and Mechanics can point at it.
     -> its names; [] if nothing in Structure shows that text; null if this isn't text in quotes. */
  function idsByText(name, shared) {
    const m = String(name).trim().match(/^(?:(?:the|every|all(?:\s+the)?)\s+)?([a-z][a-z -]*?)?\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')$/i);
    if (!m || !shared.elements) return null;
    const text = strOf(m[2]), kind = m[1] ? m[1].trim().toLowerCase() : '';
    const tags = kind ? (TAG_WORDS[kind] || TAG_WORDS[kind + 's'] || '').split(/\s*,\s*/).filter(Boolean) : null;
    if (kind && !tags.length) return null;
    const same = (s) => String(s).trim().replace(/\s+/g, ' ').toLowerCase();
    const found = shared.elements.filter(e => e.text != null && same(e.text) === same(text) && (!tags || tags.includes(e.tag)));
    if (!found.length) { const id = findId(shared, text); return id ? [id] : []; }   // a name in quotes: "main description", "Quote"
    shared.addIds = shared.addIds || {};
    return found.map(e => {
      if (e.id) return e.id;
      let id = shared.addIds[e.line];
      if (!id) {
        const base = toId(text) || e.tag;
        id = base;
        for (let k = 2; shared.ids[id] || Object.values(shared.addIds).includes(id); k++) id = `${base}-${k}`;
        shared.addIds[e.line] = id;
      }
      shared.ids[id] = shared.ids[id] || { tag: e.tag, type: null, line: e.line };
      return id;
    });
  }
  /* The name in Structure meant by how it's written here: exactly, as a name (main description is
     main-description), or the same letters in other capitals (quote is "Quote"). null if there's none. */
  function findId(shared, raw) {
    const q = strOf(raw), s = q != null ? q : String(raw).trim();
    if (shared.ids[s]) return s;
    const id = toId(s);
    if (id && shared.ids[id]) return id;
    const low = s.toLowerCase();
    return Object.keys(shared.ids).find(k => k.toLowerCase() === low || (id && toId(k) === id)) || null;
  }
  // a name as a CSS selector: #name, or [id="…"] for one a # can't take (a space in it)
  const idSel = (id) => (/^-?[A-Za-z_][\w-]*$/.test(id) ? '#' + id : `[id="${String(id).replace(/["\\]/g, '\\$&')}"]`);

  function selectorFor(name, shared, inf) {
    let n = name.trim(), m;
    const said = idsByText(n, shared);
    if (said) {
      const text = strOf(n.match(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')$/)[1]);
      if (!said.length) {
        inf.warns.push(`Nothing in Structure says ${code(text)}. Write its text exactly as it is there, or use its name.`);
        return idSel(toId(text));
      }
      const auto = said.filter(id => Object.values(shared.addIds || {}).includes(id));
      if (auto.length) note(inf, `Styles what says ${code(text)}: it has no name, so IntuaCode names it ${code(auto[0])} in the page. If its text changes, change it here too, or give it a name in Structure.`);
      else if (said[0] !== text) note(inf, `${code(text)} is ${code(said[0])}, so this styles ${code(idSel(said[0]))}.`);
      return said.map(idSel).join(', ');
    }
    // "toast.shown" or "toast:hover": a name from Structure with a group or state on it, not a <toast> tag
    if ((m = n.match(/^([a-z][\w-]*)([.:][\w\s.:()-]*)$/i)) && !HTML_TAGS.has(m[1].toLowerCase())) {
      if (shared.ids[toId(m[1])]) { note(inf, `${code(m[1])} is the element called ${m[1]}, so this is ${code('#' + toId(m[1]) + m[2])}.`); return '#' + toId(m[1]) + m[2]; }
      inf.warns.push(`There's no <${m[1]}> element, and nothing on the page is called ${code(m[1])} yet. For an element you named, write #${m[1]}${m[2]}.`);
      return n;
    }
    if (/^[.#:*\[]|[>~+\[]/.test(n) || /^[a-z]+[.#:]/.test(n)) { note(inf, `${code(n)} is a CSS selector written directly.`); return n; }
    if ((m = n.match(/^group\s+(.+)$/i))) return '.' + toId(m[1]);
    if ((m = n.match(/^(?:the element|element)\s+(.+)$/i))) return '#' + toId(m[1]);
    const every = !!(m = n.match(/^(?:every|all(?:\s+the)?)\s+(.+)$/i));
    if (every) n = m[1];
    if ((m = n.match(/^the\s+(.+)$/i)) && !TAG_WORDS[n.toLowerCase()]) n = m[1];   // "the big heading" is the big heading
    const low = n.toLowerCase();
    const id = toId(n), known = findId(shared, n);
    // an element you named (Structure's "called header") is the one meant, as in Mechanics; "every header" is the tag
    if (!every && known && (TAG_WORDS[low] || HTML_TAGS.has(low))) { note(inf, `Structure has an element called ${code(known)}, so this styles that one (\`${idSel(known)}\`). To style every ${code(TAG_WORDS[low] || low)} element, write "style every ${n}".`); return idSel(known); }
    if (TAG_WORDS[low]) return TAG_WORDS[low];
    if (known) return idSel(known);
    if (shared.groups[id] || shared.cssGroups[id]) return '.' + id;
    if (HTML_TAGS.has(low)) return low;
    if (/^[a-z0-9]+(?:\s*,\s*[a-z0-9]+)+$/.test(low) && low.split(/\s*,\s*/).every(t => HTML_TAGS.has(t))) return low.split(/\s*,\s*/).join(', ');
    inf.warns.push(`Nothing on the page is called ${code(id)} yet. Add it in Structure, or write "group ${n}" to style a group.`);
    if (shared.wanted && id) shared.wanted[id] = shared.wanted[id] || 'styling';   // Structure's Predictive Mode offers to add it
    return '#' + id;
  }

  /* Styling said the everyday way: "set "Welcome" colour to navy", "set the border of save to 2 dashed red",
     "make the big heading bold", "give save a red border". The thing styled can be a name, a group, a kind of
     element (the big heading, every button) or the text it shows, in quotes. */
  const TARGET = String.raw`((?:(?:the|every|all)\s+)?(?:[a-z][\w -]*?\s*)?"(?:[^"\\]|\\.)*"|[^"]+?)`;
  const STYLE_PROP = String.raw`text colou?r|background colou?r|colou?r|background|border|outline|(?:text |font )?size|font|(?:text |font )?weight|width|height|padding|space inside|margin|space around|rounded corners|corners|corner radius|shadow|line height|letter spacing|gap|opacity|transparency|(?:text )?alignment`;
  const SET_PROP_OF = new RegExp(String.raw`^(?:set|change|make)\s+(?:the\s+)?(${STYLE_PROP})\s+of\s+${TARGET}\s+(?:to|as)\s+(.+)$`, 'i');
  const SET_PROP = new RegExp(String.raw`^(?:set|change)\s+${TARGET}(?:'s)?\s+(${STYLE_PROP})\s+(?:to|as)\s+(.+)$`, 'i');
  const GIVE = new RegExp(String.raw`^give\s+${TARGET}\s+(?:(?:a|an|some)\s+(.+)|(rounded corners(?:\s+\S+)?|shadow))$`, 'i');
  const MAKE_LOOK = new RegExp(String.raw`^make\s+${TARGET}\s+(bold|italic|underlined|hidden|centred|centered|round|uppercase|capitals|#\S*|[a-z]+)$`, 'i');
  /* "colour" and the value set to it, as the words cssProps knows: text colour navy, rounded corners 8 … */
  function propPhrase(prop, value) {
    const p = prop.toLowerCase().replace(/colour/g, 'color').replace(/\s+/g, ' '), v = value.trim();
    if (/^(?:text )?color$/.test(p)) return `text colour ${v}`;
    if (/^background/.test(p)) return `background ${v}`;
    if (/size$/.test(p)) return `text size ${v}`;
    if (/weight$/.test(p)) return `text weight ${v}`;
    if (p === 'padding' || p === 'space inside') return `space inside ${v}`;
    if (p === 'margin' || p === 'space around') return `space around ${v}`;
    if (/corner/.test(p)) return `rounded corners ${v}`;
    if (/alignment$/.test(p)) return `text aligned ${v}`;
    if (p === 'transparency') return `${/%$/.test(v) ? v : v + '%'} see-through`;
    if (p === 'opacity') { const pc = v.match(/^(\d+(?:\.\d+)?)%$/); return `opacity: ${pc ? +(pc[1] / 100).toFixed(2) : v}`; }
    return `${p} ${v}`;   // border, outline, font, width, height, shadow, line height, letter spacing, gap
  }

  /* "h1, h2, h3" + ":hover" -> "h1:hover, h2:hover, h3:hover": each selector in a list gets it. */
  const withPseudo = (sel, pseudo) => splitItems(sel).map(s => s + pseudo).join(', ');

  function compileCss(sec, shared) {
    const lines = sec.text.split('\n');
    const info = makeInfo(lines);
    const out = [];
    const push = (text, src) => out.push({ text, src });
    const rules = [];   // {sel, props, media, src}
    const vars = [];
    let media = null, mediaInd = -1;
    // first pass: groups defined here
    for (const raw of lines) { const g = raw.trim().match(/^(?:create|make|add) (?:a )?(?:new )?(?:colou?r |style )?group\s+(?:called\s+|named\s+)?(.+?)\s*(?::|$)/i); if (g) shared.cssGroups[toId(g[1])] = true; }
    const EXACT = /^([ \t]*)(?:css|raw)\s*:\s?(.*?)\r?$/i;
    const exactBlank = blanksBetween(lines, (l) => EXACT.test(l));
    lines.forEach((raw, i) => {
      const inf = info[i];
      if (!raw.trim()) { if (exactBlank.has(i)) rules.push({ blank: true, src: i, media }); return; }
      const ind = raw.match(/^ */)[0].length;
      let s = raw.trim();
      // curly quotes count as straight ones, except in CSS copied exactly
      if (!/^(?:css|raw|note|comment)\s*:/i.test(s)) { const st = straightQuotes(s); if (st !== s) { s = st; note(inf, CURLY_NOTE); } }
      const lead = s.match(FILLER);
      const named = s.match(/^([\w\s-]+?)\s+(?:belongs to|is in|joins)\s+group\s/i);   // "next card belongs to group …": "next" is part of the name
      if (lead && lead[0].length < s.length && !(named && shared.ids[toId(named[1])])) { note(inf, `Left out filler: "${lead[0].trim()}".`); s = s.slice(lead[0].length); }
      if (media && ind <= mediaInd) media = null;
      let m;
      if ((m = s.match(/^(?:note|comment)\s*:\s*(.*)$/i))) { rules.push({ comment: m[1], src: i, media }); return; }
      // exact CSS, to the end of the line; it keeps its own indentation, unless it's under "on screens …"
      if ((m = s.match(/^(?:css|raw)\s*:\s?(.*)$/i))) {
        const e = raw.match(EXACT) || [null, '', m[1]];   // (after filler: "then css: …")
        rules.push({ raw: e[2], ind: e[1], src: i, media });
        return;
      }
      if ((m = s.match(/^on (?:screens|phones|devices) (narrower|smaller|wider|bigger) than\s+(\S+?|-?[\d.]+\s+[a-z]+)\s*:?$/i))) {
        const w = unit(m[2], inf);
        media = /narrower|smaller/i.test(m[1]) ? `(max-width: ${w})` : `(min-width: ${w})`;
        mediaInd = ind;
        note(inf, `Styles indented under this only apply ${/narrower|smaller/i.test(m[1]) ? 'on screens up to' : 'on screens at least'} ${w} wide (a media query).`);
        inf.media = true;
        return;
      }
      if (/^in dark mode\s*:?$/i.test(s)) { media = '(prefers-color-scheme: dark)'; mediaInd = ind; inf.media = true; note(inf, 'Styles indented under this apply when the device is set to dark mode.'); return; }
      const sharedColour = (name, value) => {
        vars.push([`--${toId(name)}`, color(value, inf), i]);
        note(inf, `A shared colour (a CSS variable, ${code('--' + toId(name))}). Use it anywhere as "the colour ${/\s/.test(name.trim()) ? name.trim().replace(/\s+/g, ' ') : toId(name)}"; change it here to change it everywhere.`);
      };
      if ((m = s.match(/^(?:shared|main) colou?r\s+([\w-]+(?:\s+[\w-]+)*?)\s+is\s+(.+)$/i))) return sharedColour(m[1], m[2]);
      if ((m = s.match(/^([\w\s-]+?)\s+(?:belongs to|is in|joins)\s+group\s+(.+)$/i))) {
        const id = toId(m[1]), g = toId(m[2]);
        (shared.addGroups[id] = shared.addGroups[id] || []).push(g);
        shared.cssGroups[g] = true;
        if (!shared.ids[id]) inf.errs.push(`Nothing in Structure is called ${code(id)}.`);
        else note(inf, `Adds group ${code(g)} (a class) to ${code(id)} in Structure, so the group's styles apply to it.`);
        inf.crossFile = 'structure';
        return;
      }
      if ((m = s.match(/^(?:create|make|add)\s+(?:a\s+)?(?:new\s+)?(?:colou?r\s+|style\s+)?group\s+(?:called\s+|named\s+)?(.+?)\s*(?::\s*(.*))?$/i))) {
        const sel = '.' + toId(m[1]);
        note(inf, `A group is a CSS class: ${code(sel)}. Put things in it with "${toId(m[1])} belongs to group …" or "in group …" in Structure.`);
        if (!(m[2] || '').trim()) note(inf, 'Nothing in it yet: add styles after a colon, like "add group card: rounded corners, shadow".');
        rules.push({ sel, props: (m[2] || '').trim() ? cssProps(m[2], inf) : [], media, src: i });
        return;
      }
      if ((m = s.match(/^when\s+(.+?)\s+is\s+(hovered|pointed at|clicked|focused with the keyboard|focused|selected|disabled|visited|empty)\s*:\s*(.+)$/i)) ||
          (m = s.match(/^when\s+(.+?)\s+(has focus inside)\s*:\s*(.+)$/i))) {
        const pseudo = { hovered: ':hover', 'pointed at': ':hover', clicked: ':active', focused: ':focus', 'focused with the keyboard': ':focus-visible', selected: ':checked', disabled: ':disabled', visited: ':visited', empty: ':empty', 'has focus inside': ':focus-within' }[m[2].toLowerCase()];
        rules.push({ sel: withPseudo(selectorFor(m[1], shared, inf), pseudo), props: cssProps(m[3], inf), media, src: i });
        note(inf, `${code(pseudo)} applies these styles only ${m[2].toLowerCase() === 'hovered' || m[2].toLowerCase() === 'pointed at' ? 'while the mouse is over it' : m[2].toLowerCase() === 'has focus inside' ? 'while something inside it is focused' : 'while it is ' + m[2].toLowerCase()}.`);
        return;
      }
      // "set "Welcome" colour to navy", "set the border of save to 2 dashed red"
      if ((m = s.match(SET_PROP_OF)) || (m = s.match(SET_PROP))) {
        const [prop, target, value] = SET_PROP_OF.test(s) ? [m[1], m[2], m[3]] : [m[2], m[1], m[3]];
        rules.push({ sel: selectorFor(target, shared, inf), props: cssProps(propPhrase(prop, value), inf), media, src: i });
        return;
      }
      // "give save a red border", "give the big heading rounded corners"
      if (!/:/.test(s) && (m = s.match(GIVE))) {
        const phrase = (m[2] || m[3]).replace(/^(.+?)\s+(border|outline|shadow)$/i, '$2 $1').replace(/^(soft|big|strong)\s+shadow\s*$/i, '$1 shadow');
        rules.push({ sel: selectorFor(m[1], shared, inf), props: cssProps(phrase, inf), media, src: i });
        return;
      }
      // "make the big heading bold", "make save navy"
      if (!/:/.test(s) && (m = s.match(MAKE_LOOK)) && !/^(?:a|an|the|new)$/i.test(m[1].trim())) {
        let target = m[1], w = m[2];
        const word = /^(?:bold|italic|underlined|hidden|centred|centered|round|uppercase|capitals)$/i.test(w);
        // a colour of several words ("make save royal blue") takes the words before it too, the most that make one
        if (!word && !/"/.test(target)) {
          const ws = target.trim().split(/\s+/);
          for (let k = Math.min(3, ws.length - 1); k >= 1; k--) {
            const said = [...ws.slice(ws.length - k), w].join(' '), scratch = { notes: [], warns: [], errs: [] };
            if (/^[a-z]+(?:\s+[a-z]+)+$/i.test(said) && (color(said, scratch), !scratch.errs.length)) { target = ws.slice(0, ws.length - k).join(' '); w = said; break; }
          }
        }
        if (word || /^#/.test(w) || /\s/.test(w) || NAMED.has(w.toLowerCase())) {
          rules.push({ sel: selectorFor(target, shared, inf), props: cssProps(word ? w : `text colour ${w}`, inf), media, src: i });
          return;
        }
      }
      // "add a colour called main #4f7cff": a shared colour. Its name runs up to the colour: "main blue #4f7cff" is
      // main-blue, and "accent royal blue" is accent (the longest colour wins)
      if ((m = s.match(/^add\s+(?:a\s+)?(?:shared\s+|main\s+)?colou?r\s+(?:called\s+|named\s+)?([\w-]+(?:\s+[\w-]+)*?)\s+(?:is\s+|as\s+|=\s*|of\s+)?(\S.*)$/i)) && !/^group$/i.test(m[1])) {
        const ws = (m[1] + ' ' + m[2]).split(/\s+/);
        let name = m[1], value = m[2];
        for (let k = 1; k < ws.length; k++) {
          if (!/^[\w-]+$/.test(ws[k - 1])) break;
          const rest = ws.slice(k).join(' ').replace(/^(?:is|as|of)\s+|^=\s*/i, ''), scratch = { notes: [], warns: [], errs: [] };
          if (rest && (color(rest, scratch), !scratch.errs.length)) { name = ws.slice(0, k).join(' '); value = rest; break; }
        }
        return sharedColour(name, value);
      }
      // "add save to group primary", "add "Welcome" to group highlight": the same as "save belongs to group primary"
      if ((m = s.match(new RegExp(String.raw`^add\s+${TARGET}\s+to\s+(?:the\s+)?group\s+([\w -]+)$`, 'i')))) {
        const ids = idsByText(m[1], shared) || (shared.ids[toId(m[1])] ? [toId(m[1])] : null);
        if (ids && ids.length) {
          const g = toId(m[2]);
          for (const id of ids) (shared.addGroups[id] = shared.addGroups[id] || []).push(g);
          shared.cssGroups[g] = true;
          note(inf, `Adds group ${code(g)} (a class) to ${code(ids[0])} in Structure, so the group's styles apply to it.`);
          inf.crossFile = 'structure';
          return;
        }
      }
      // "add a border to card", "add rounded corners to group card": the same as "style card: border"
      if ((m = s.match(/^add\s+(?:a\s+|an\s+|some\s+)?(.+?)\s+to\s+(.+?)$/i)) && !/^(?:css|raw)\s*:/i.test(s)) {
        const phrase = m[1].replace(/^(.+?)\s+(border|outline)$/i, '$2 $1');
        rules.push({ sel: selectorFor(m[2], shared, inf), props: cssProps(phrase, inf), media, src: i });
        return;
      }
      if ((m = s.match(/^(before|after|at the (?:start|end) of)\s+(.+?)\s*:(?!:)\s*(.+)$/i))) {
        const pseudo = /^(?:before|at the start)/i.test(m[1]) ? '::before' : '::after';
        const props = cssProps(m[3], inf);
        rules.push({ sel: withPseudo(selectorFor(m[2], shared, inf), pseudo), props, media, src: i });
        note(inf, `${code(pseudo)} adds a piece ${pseudo === '::before' ? 'at the start' : 'at the end'} of the element, inside it, made only by CSS. \`content\` is what it shows: text in quotes, or \`attr(data-…)\` for a value Mechanics stored on the element.`);
        if (!props.some(([p]) => p === 'content')) inf.warns.push('Nothing appears without content: add content: "…" (or content: "" for an empty piece to style).');
        return;
      }
      // the name ends at the first colon with a space after it, so "li::before" and "a:hover" stay whole
      if ((m = s.match(/^(?:style|make|give)\s+(.+?)\s*:(?=\s|$)\s*(.+)$/i)) || (m = s.match(/^(?:style|make|give)\s+(.+?)\s*:\s*(.+)$/i))) {
        rules.push({ sel: selectorFor(m[1], shared, inf), props: cssProps(m[2], inf), media, src: i });
        return;
      }
      // "style save:" with nothing after it yet: a place for its styles
      if ((m = s.match(/^style\s+(.+?)\s*:?\s*$/i))) {
        rules.push({ sel: selectorFor(m[1], shared, inf), props: [], media, src: i });
        note(inf, `Nothing styled yet: add styles after the colon, like "style ${m[1]}: text colour navy".`);
        return;
      }
      inf.errs.push('I don\'t recognise this sentence. Styling sentences start like "set save colour to navy", "style save: …", "give save a border", "add group card: …" or "on screens narrower than 600: …".');
    });
    if (vars.length) {
      push(':root {', vars[0][2]);
      for (const [k, v, src] of vars) push(`  ${k}: ${v};`, src);
      push('}', vars[0][2]);
      push('', -1);
    }
    // a blank line between exact lines stays when both are in the same place (under the same "on screens …", or neither)
    for (let k = rules.length - 1, next; k >= 0; k--) { if (!rules[k].blank) next = rules[k].media; else if (rules[k].media !== next) rules.splice(k, 1); }
    let curMedia = null;
    const close = () => { if (curMedia) { push('}', -1); push('', -1); curMedia = null; } };
    for (const r of rules) {
      if (r.blank) { push('', r.src); continue; }
      if (r.media !== curMedia) { close(); if (r.media) { push(`@media ${r.media} {`, r.src); curMedia = r.media; } }
      const pad = curMedia ? '  ' : '';
      if (r.comment != null) { push(`${pad}/* ${r.comment} */`, r.src); continue; }
      if (r.raw != null) { push((curMedia ? pad : r.ind) + r.raw, r.src); continue; }
      push(`${pad}${r.sel} {`, r.src);
      for (const [p, v] of r.props) push(`${pad}  ${p}: ${v};`, r.src);
      push(`${pad}}`, r.src);
      if (!curMedia) push('', -1);
    }
    close();
    while (out.length && !out[out.length - 1].text) out.pop();
    out.forEach((o, idx) => { if (o.src >= 0) info[o.src].py.push(idx); });
    return { lines: out, info, text: out.map(o => o.text).join('\n') + '\n' };
  }

  /* ================================================================== */
  /* JavaScript: Mechanics                                               */
  /* ================================================================== */

  const JS_WORDS = [
    [/\bis not (?:nothing|none)\b/gi, ' != null'],
    [/\bis (?:nothing|none)\b/gi, ' == null'],
    [/\bis not (?:equal to|the same as)\b|\bisn't\b|\bis not\b/gi, ' !== '],
    [/\bis (?:greater|more|bigger|higher) than or equal to\b|\bis at least\b/gi, ' >= '],
    [/\bis (?:less|smaller|lower|fewer) than or equal to\b|\bis at most\b/gi, ' <= '],
    [/\bis (?:greater|more|bigger|higher) than\b|\bis over\b/gi, ' > '],
    [/\bis (?:less|smaller|lower|fewer) than\b|\bis under\b/gi, ' < '],
    [/\bis (?:empty)\b/gi, '.length === 0'],
    [/\bis (?:equal to|the same as)\b|\bequals\b|\bis\b/gi, ' === '],
    [/\bplus\b/gi, ' + '], [/\bminus\b/gi, ' - '], [/\btimes\b/gi, ' * '], [/\bdivided by\b/gi, ' / '], [/\bmod\b/gi, ' % '],
    [/\band\b/gi, ' && '], [/\bor\b/gi, ' || '], [/\bnot\b/gi, ' !'],
    [/\b(?:yes|true)\b/gi, 'true'], [/\b(?:no|false)\b/gi, 'false'], [/\b(?:nothing|none)\b/gi, 'null'],
  ];

  /* Names a sentence can use as one value: a JavaScript name, or a page element's name with dashes in it
     (meter-fill), longest first so a longer name is never cut short. */
  function nameSource(x) {
    const dashed = Object.keys(x.shared.ids).filter(id => id.includes('-')).sort((a, b) => b.length - a.length).map(id => id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    return dashed.length ? String.raw`(?:(?:${dashed.join('|')})(?![\w$-])|[A-Za-z_$][\w$]*)` : String.raw`[A-Za-z_$][\w$]*`;
  }
  /* Names JavaScript in a browser already has, so using them is never "not set yet". A page element with the
     same name still comes first. */
  const BROWSER_NAMES = /^(?:Object|Array|URL|crypto|navigator|Intl|Promise|Set|Map|WeakMap|Symbol|Error|Infinity|NaN|BigInt|Boolean|RegExp|location|history|performance|sessionStorage|screen|globalThis|Audio|AudioContext|Event|Image|FileReader|Blob|Notification|Uint8Array|Uint32Array|Float32Array|Int32Array|alert|confirm|prompt|fetch|setTimeout|setInterval|clearTimeout|clearInterval|requestAnimationFrame|cancelAnimationFrame|parseInt|parseFloat|isNaN|isFinite|encodeURIComponent|decodeURIComponent|matchMedia|structuredClone|AbortController|AbortSignal|TextEncoder|TextDecoder|Response|Request|Headers|FormData|URLSearchParams|WebSocket|Worker|BroadcastChannel|IntersectionObserver|ResizeObserver|MutationObserver|CustomEvent|KeyboardEvent|MouseEvent|DOMParser|Proxy|Reflect|atob|btoa|queueMicrotask|ArrayBuffer|DataView|Uint8ClampedArray|Int8Array|Int16Array|Uint16Array|Float64Array|MIDIAccess|OfflineAudioContext|AudioWorkletNode|MediaRecorder|MediaStream|devicePixelRatio)$/;

  /* "random number from A to B". The low end runs to "to" (or "and"), so it can be a calculation
     ("from gap plus 10 to …"). The high end is one value, or a calculation in brackets: in "to height minus
     gap", the minus could belong to the end or to the random number, so that is an error asking for
     brackets rather than a guess. The ends stay as sentence words here; the rest of jsExpr turns them
     into JavaScript. */
  function randomRange(q, OPD, strs, inf, src) {
    const said = (t) => t.replace(/⟦(\d+)⟧/g, (m, i) => strs[+i]).replace(/\s+/g, ' ').trim();
    /* The person's own words for the nth random number, its ends, and the calculation after it, for the
       error message (q has some words already turned into JavaScript). */
    const theirWords = (nth, op) => {
      const masked = src.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, (m) => m[0] + '\u0001'.repeat(m.length - 2) + m[0]);
      const at = [...masked.matchAll(/\brandom (?:whole )?number (?:from|between) /gi)][nth];
      if (!at) return null;
      const from = at.index + at[0].length, to = masked.slice(from).search(/ (?:to|and) /i);
      if (to < 0) return null;
      const bStart = from + to + masked.slice(from + to).match(/ (?:to|and) /i)[0].length;
      const opAt = masked.slice(bStart).search(new RegExp(`\\s${op}\\s`, 'i'));
      if (opAt < 0) return null;
      const restStart = bStart + opAt + 1, restEnd = masked.slice(restStart).search(/[,)\]}]| (?:is|isn't|and|or|then)\b|$/i);
      return { phrase: src.slice(at.index, bStart + opAt).trim(), low: src.slice(at.index, bStart).trim(), b: src.slice(bStart, bStart + opAt).trim(), rest: src.slice(restStart, restStart + restEnd).trim() };
    };
    const simple = new RegExp(`^${OPD}$`, 'i'), high = new RegExp(String.raw`^(?:\((?:[^()]|\([^()]*\))*\)|${OPD})`, 'i');
    for (let guard = 0, mm; guard < 6 && (mm = /\brandom (?:whole )?number (?:from|between) /i.exec(q)); guard++) {
      const start = mm.index + mm[0].length;
      let depth = 0, sep = -1, sepLen = 0;
      for (let k = start; k < q.length; k++) {
        const c = q[k];
        if ('([{'.includes(c)) depth++;
        else if (')]}'.includes(c)) { if (--depth < 0) break; }
        else if (depth === 0 && c === ' ') { const w = q.slice(k).match(/^ (?:to|and) /i); if (w) { sep = k; sepLen = w[0].length; break; } }
      }
      const a = sep < 0 ? '' : q.slice(start, sep).trim(), hb = sep < 0 ? null : q.slice(sep + sepLen).match(high);
      if (!a || !hb) { inf.errs.push('Say both ends of the random number, like: random number from 1 to 6.'); break; }
      const b = hb[0], end = sep + sepLen + b.length, after = q.slice(end).match(new RegExp(String.raw`^ (plus|minus|times|divided by|mod)(?: ${OPD})?`, 'i'));
      if (after) {
        const w = theirWords(guard, after[1]) || { phrase: said(q.slice(mm.index, end)), low: said(q.slice(mm.index, sep + sepLen)), b: said(b), rest: said(after[0]) };
        inf.errs.push(`"${w.phrase} ${w.rest}" could mean two things. Put brackets round what you mean: ${w.low} (${w.b} ${w.rest}), or (${w.phrase}) ${w.rest}.`);
      }
      const A = simple.test(a) ? a : `(${a})`;
      note(inf, '`Math.random()` gives a decimal from 0 to 1; multiplying and rounding down turns it into a whole number between the two ends, both included.');
      q = q.slice(0, mm.index) + `(Math.floor(Math.random() * (${b} - ${A} + 1)) + ${A})` + q.slice(end);
    }
    return q;
  }

  // Brackets with brackets inside, up to 4 deep (a regular expression can't count further).
  const nest = (o, c) => { let s = `[^${o}${c}]*`; for (let i = 0; i < 3; i++) s = `(?:[^${o}${c}]|${o}${s}${c})*`; return o + s + c; };
  const PAREN = nest('\\(', '\\)'), SQUARE = nest('\\[', '\\]');

  /* After the words have become JavaScript: shapes that would mean something other than the sentence.
     - "not x is y" became !x === y (not applies to x alone in JavaScript): it's !(x === y).
     - "1 is less than x is less than 10" became 1 < x < 10, which is always true: it's 1 < x && x < 10.
     - "answer is "yes" or "y"" became answer === "yes" || "y", always true: the name is said again; any
       other comparison with a bare value after && or || is an error. */
  function jsTwoReadings(q, OPD, strs, inf) {
    const said = (t) => t.trim().replace(/⟦(\d+)⟧/g, (_, i) => strs[+i]);
    q = q.replace(new RegExp(String.raw`!\s*(${OPD})\s+(===|!==|<=|>=|<|>)\s+(${OPD})`, 'g'), (m, a, op, b) => { note(inf, '`!` would apply to the first value alone, so the whole comparison goes in brackets: `!(…)`.'); return `!(${a} ${op} ${b})`; });
    q = q.replace(new RegExp(String.raw`(?<![\w$.⟧\])])(${OPD})\s+(<=|>=|<|>)\s+(${OPD})\s+(<=|>=|<|>)\s+(${OPD})`, 'g'), (m, a, op1, b, op2, c) => {
      if (!/^[A-Za-z_$][\w$]*$|^-?\d+(?:\.\d+)?$/.test(b)) { inf.errs.push(`"${said(m)}" is two comparisons in a row, which JavaScript doesn't read the way it sounds. Say it as two tests joined by "and".`); return m; }
      note(inf, `JavaScript reads \`${a} ${op1} ${b} ${op2} ${c}\` one comparison at a time (always true or false), so it is written as two tests: \`${a} ${op1} ${b} && ${b} ${op2} ${c}\`.`);
      return `${a} ${op1} ${b} && ${b} ${op2} ${c}`;
    });
    const EITHER = new RegExp(String.raw`(?<![\w$.⟧\])])(${OPD})\s+(===|!==|<=|>=|<|>)\s+(${OPD})\s+(&&|\|\|)\s+(⟦\d+⟧|-?\d+(?:\.\d+)?|true|false|null)(?=\s*(?:$|[)\],;]|&&|\|\|))`);
    for (let guard = 0, m; guard < 8 && (m = q.match(EITHER)); guard++) {
      const [all, lhs, op, rhs, join, lit] = m;
      if (op === '===' && join === '||' && /^[A-Za-z_$][\w$.]*(?:\[[^\]]*\])*$/.test(lhs)) {
        note(inf, `\`||\` joins two whole tests, so the name is said again: \`${lhs} === … || ${lhs} === …\`. (\`${lhs} === ${said(rhs)} || ${said(lit)}\` would always be true.)`);
        q = q.slice(0, m.index) + `${lhs} === ${rhs} || ${lhs} === ${lit}` + q.slice(m.index + all.length);
        continue;
      }
      inf.errs.push(`"… ${join === '&&' ? 'and' : 'or'} ${said(lit)}" could mean two things, and as JavaScript it would test ${code(said(lit))} on its own. Say the whole test each time, like: x is "a" or x is "b".`);
      break;
    }
    return q;
  }

  /* Brackets right after a phrase like "length of x" would apply to its result: x.length (…) runs the
     number .length gives back. That is an error on the line, never JavaScript that is silently wrong. */
  function looseBrackets(m, q, strs, inf) {
    const after = q.slice(m.index + m[0].length), last = m[m.length - 1];
    const said = (t) => t.trim().replace(/⟦(\d+)⟧/g, (_, i) => strs[+i]);
    const err = (e) => { if (!inf.errs.includes(e)) inf.errs.push(e); };
    if (/^\s+[([]/.test(after)) {
      const br = after.trim()[0] === '(' ? '(…)' : '[…]';
      err(`The brackets after "${said(m[0])}" don't belong to anything.` + (/^[A-Za-z_$][\w$]*$/.test(last) ? ` If they go with ${code(last)}, write them right after it, with no space: ${code(last + br)}.` : ''));
    } else if (/^[([]/.test(after)) {
      err(`The translator can't follow the brackets in "${said(m[0] + after.match(/^\S*/)[0])}": too many inside each other, or one isn't closed. Work out the inner part on the line before and store it, or write this line as js:.`);
    }
  }

  /* Exact JavaScript over several lines: is a template literal (`…`) still open at the end of this line? Gives
     back what is open (templates, and ${ … } inside them), or null; open: the same, at the start of the line. */
  function templateOpenAfter(line, open) {
    const st = open ? [...open] : [];   // '`': a template's text; a number: braces open inside its ${ … }
    let q = null;
    for (let k = 0; k < line.length; k++) {
      const c = line[k], top = st[st.length - 1];
      if (q) { if (c === '\\') k++; else if (c === q) q = null; continue; }
      if (top === '`') {
        if (c === '\\') k++;
        else if (c === '`') st.pop();
        else if (c === '$' && line[k + 1] === '{') { st.push(0); k++; }
        continue;
      }
      if (c === '"' || c === "'") q = c;
      else if (c === '`') st.push('`');
      else if (c === '/' && line[k + 1] === '/') break;
      else if (typeof top === 'number') { if (c === '{') st[st.length - 1]++; else if (c === '}') { if (top === 0) st.pop(); else st[st.length - 1]--; } }
    }
    return st.includes('`') ? st : null;
  }

  /* s with quoted text and everything inside brackets hidden (the same length), so a phrase is only found at
     the top level of a value. */
  function topMask(s) {
    const q = String(s).replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/g, (m) => '\u0001'.repeat(m.length));
    let out = '', depth = 0;
    for (let i = 0; i < q.length; i++) {
      const c = q[i];
      if ('([{⟦'.includes(c)) { out += depth ? '\u0001' : c; depth++; continue; }
      if (')]}⟧'.includes(c)) { depth = Math.max(0, depth - 1); out += depth ? '\u0001' : c; continue; }
      out += depth ? '\u0001' : c;
    }
    return out;
  }
  /* The first match of re in s at the top level: { at, end } (indexes into s), or null. */
  const topFind = (s, re, from = 0) => { const m = re.exec(topMask(s).slice(from)); return m ? { at: from + m.index, end: from + m.index + m[0].length } : null; };
  const JS_NAME = String.raw`[A-Za-z_$][\w$]*`, JS_PATH = String.raw`${JS_NAME}(?:\.${JS_NAME})*`;

  /* Phrases that take a whole value, as Python's do: "the result of f with a, b", "a new Date", "a if c otherwise
     b", "a list of x times 2 for each x in xs if x is more than 1", "x is done for every x in xs", "the first x in
     xs where …", and "wait for" before any of them. In brackets they work inside a bigger value too (see
     wholeGroups). Gives back the JavaScript, or null when s isn't one. */
  function jsWhole(s, x, inf) {
    s = String(s).trim();
    // a dialect's own phrases first (TypeScript's, React's: see lang/ts_write.js), with this writer for the rest
    if (x.ext && x.ext.expr) { const own = x.ext.expr(s, x, inf, (t) => jsExpr(t, x, inf)); if (own != null) return own; }
    let m, f;
    const sub = (t, names = []) => {   // a part, with the little function's input as a name inside it
      const added = names.filter(n => !x.vars.has(n));
      added.forEach(n => x.vars.add(n));
      try { return jsExpr(t, x, inf); } finally { added.forEach(n => x.vars.delete(n)); }
    };
    const body = (t, p) => { const v = sub(t, [p]); return /^\{/.test(v) ? `(${v})` : v; };   // (a record given back needs brackets)
    const args = (t) => (t ? splitAnd(t).map(a => jsExpr(a, x, inf)).join(', ') : '');
    if ((m = s.match(/^wait for\s+(.+)$/i))) { const w = jsWhole(m[1], x, inf); return w == null ? null : `await ${w}`; }
    // "x, or y if that is nothing": x, unless it is null or undefined (??)
    const tm = topMask(s), nothingAt = tm.search(/\s+if (?:that|it) is nothing$/i);
    if (nothingAt > 0) {
      const ors = [...tm.slice(0, nothingAt).matchAll(/,?\s+or\s+/gi)], or = ors[ors.length - 1];
      if (or) {
        note(inf, '`a ?? b` is a, unless a is null or undefined (nothing): then it is b.');
        return `${jsExpr(s.slice(0, or.index), x, inf)} ?? ${jsExpr(s.slice(or.index + or[0].length, nothingAt), x, inf)}`;
      }
    }
    // a list made from another, item by item: .map, and .filter for "if"
    if ((m = s.match(/^a list of\s+/i)) && (f = topFind(s, /\s+for each\s+/i, m[0].length))) {
      const e = s.slice(m[0].length, f.at), rest = s.slice(f.end), pm = rest.match(new RegExp(`^(${JS_NAME})\\s+in\\s+`, 'i'));
      if (!pm || !e.trim()) return null;
      const p = pm[1], tail = rest.slice(pm[0].length), c = topFind(tail, /\s+if\s+/i);
      const list = jsExpr(c ? tail.slice(0, c.at) : tail, x, inf), cond = c ? body(tail.slice(c.end), p) : null;
      const kept = cond ? `${list}.filter(${p} => ${cond})` : list;
      note(inf, cond ? '`.filter` keeps the items the test is true for' + (e.trim() === p ? '.' : '; `.map` then makes a new list from each of them.') : '`.map` makes a new list, one value for each item.');
      return e.trim() === p && cond ? kept : `${kept}.map(${p} => ${body(e, p)})`;
    }
    // a test of every item, or any item
    if ((f = topFind(s, new RegExp(`\\s+for (every|any)\\s+(${JS_NAME})\\s+in\\s+`, 'i')))) {
      const [, which, p] = s.slice(f.at, f.end).trim().match(new RegExp(`^for (every|any)\\s+(${JS_NAME})`, 'i'));
      note(inf, /^every$/i.test(which) ? '`.every` is true when the test is true for every item.' : '`.some` is true when the test is true for at least one item.');
      return `${jsExpr(s.slice(f.end), x, inf)}.${/^every$/i.test(which) ? 'every' : 'some'}(${p} => ${body(s.slice(0, f.at), p)})`;
    }
    if ((m = s.match(new RegExp(`^the first (${JS_NAME}) (?:in|of)\\s+`, 'i'))) && (f = topFind(s, /\s+where\s+/i, m[0].length))) {
      note(inf, '`.find` gives back the first item the test is true for (`undefined` if there is none).');
      return `${jsExpr(s.slice(m[0].length, f.at), x, inf)}.find(${m[1]} => ${body(s.slice(f.end), m[1])})`;
    }
    // "a if c otherwise b"
    if ((f = topFind(s, /\s+if\s+/i))) {
      const o = topFind(s, /\s+otherwise\s+/i, f.end);
      if (o) {
        note(inf, '`c ? a : b` is a if c is true, b otherwise.');
        const was = x.cond; x.cond = true;
        let c; try { c = jsExpr(s.slice(f.end, o.at), x, inf); } finally { x.cond = was; }
        return `${c} ? ${jsExpr(s.slice(0, f.at), x, inf)} : ${jsExpr(s.slice(o.end), x, inf)}`;
      }
    }
    if ((m = s.match(new RegExp(`^(?:the )?(?:result|answer) of (${JS_PATH})(?:\\s+with\\s+(.+))?$`, 'i')))) return `${jsExpr(m[1], x, inf)}(${args(m[2])})`;
    if ((m = s.match(new RegExp(`^an? new (${JS_PATH})(?:\\s+with\\s+(.+))?$`, 'i'))) && !(/^[a-z]/.test(m[1]) && MAKE_NEW.test('make ' + s))) {   // ("a new button" is an element: make-new)
      note(inf, `\`new\` makes a new ${code(m[1])} object.`);
      return `new ${m[1]}(${args(m[2])})`;
    }
    return null;
  }
  /* Bracketed parts of a value that hold a whole-value phrase ("(the result of f with x) plus 1") become one
     operand, ⟦n⟧, holding their JavaScript. q has its quoted text as ⟦n⟧ already. */
  function wholeGroups(q, strs, x, inf) {
    let out = '';
    for (let i = 0; i < q.length; i++) {
      if (q[i] === '(') {
        let depth = 0, end = -1;
        for (let k = i; k < q.length; k++) { if (q[k] === '(') depth++; else if (q[k] === ')' && --depth === 0) { end = k; break; } }
        if (end > 0) {
          const inner = q.slice(i + 1, end).replace(/⟦(\d+)⟧/g, (mm, n) => strs[+n]);
          const js = /\s/.test(inner.trim()) ? jsWhole(inner, x, inf) : null;
          // (a call needs no brackets of its own: f(x) + 1, new Date().getTime())
          if (js != null) { strs.push(/^(?:the\s+)?(?:result|answer) of\s|^an? new\s/i.test(inner.trim()) ? js : `(${js})`); out += ` ⟦${strs.length - 1}⟧` + (/^(?:\.[A-Za-z_$]|\[)/.test(q.slice(end + 1)) ? '' : ' '); i = end; continue; }
        }
      }
      out += q[i];
    }
    return out;
  }

  /* Numbers as people write them, in a value (its text in quotes already hidden as ⟦n⟧): $5, €5, £5 and 5.00 € are
     5, 50% and 50 percent are 0.5, and "15% of total" is 0.15 times total (7 % 2, with spaces, and 7%2 stay "mod");
     × ÷ and − are * / and -. What JavaScript can't read is a problem that says what to write: 1.5.2, 50px, a quote
     mark left open, and two values ("5,5", "1, 2") where the sentence takes one. */
  function numbersAsWritten(q, x, inf) {
    const err = (e) => { if (!inf.errs.includes(e)) inf.errs.push(e); };
    // a quote mark left open would make the rest of the line text
    for (const c of ['"', '`']) if (q.includes(c)) err(`A piece of text is missing its closing quote mark (${c}).`);
    const apostrophe = q.match(/[\w’]+'[\w’']*/);
    if (apostrophe) err(`Put text in quotes, like "${apostrophe[0]}": in code, an apostrophe on its own starts a piece of text.`);
    else if (q.includes("'")) err("A piece of text is missing its closing quote mark (').");
    if (/[×÷−]/.test(q)) { q = q.replace(/×/g, ' * ').replace(/÷/g, ' / ').replace(/−/g, '-'); note(inf, '× ÷ and − are written * / and - in code.'); }
    const money = (c, n) => { note(inf, `${code(c + n)} is the number ${code(n)} in code. Text like "${c}${n}" shows it with its ${c}.`); return n; };
    q = q.replace(/(?<![\w$.⟧])([$€£¥])\s?(\d+(?:\.\d+)?)(?![\w$])/g, (m, c, n) => money(c, n)).replace(/(?<![\w$.⟦⟧])(\d+(?:\.\d+)?)\s?([€£¥$])(?![\w$])/g, (m, n, c) => money(c, n));
    q = q.replace(/(?<![\w$.⟧])(\d+(?:\.\d+)?)\s*(?:percent|per cent)\b/gi, '$1%');
    const share = (n) => String(Number((parseFloat(n) / 100).toPrecision(15)));
    q = q.replace(/(?<![\w$.⟧])(\d+(?:\.\d+)?)%\s+of\s+(?=[\w$(⟦-])/gi, (m, n) => { note(inf, `${code(n + '%')} of something is ${code(share(n))} times it.`); return `${share(n)} times `; });
    q = q.replace(/(?<![\w$.⟧])(\d+(?:\.\d+)?)%(?!\s*(?:(?!(?:plus|minus|times|divided|mod|and|or|is|isn't|if|otherwise|then|to|by|as|for|in)\b)[\w$(⟦]|-\s*[\d(]))/gi, (m, n) => { note(inf, `${code(n + '%')} is ${code(share(n))} in code: a share of 1.`); return share(n); });
    for (const m of q.matchAll(/(?<![\w$.⟧])\d+\.\d+(?:\.\d+)+/g)) err(`${code(m[0])} isn't a number: a number has one decimal point. For text, put it in quotes: "${m[0]}".`);
    // "50px": a size for a style is text in code; a number is the number on its own (0x1f, 1e3 and 10n are numbers)
    for (const m of q.matchAll(/(?<![\w$.⟦⟧])(?!0[xob])(\d+(?:\.\d+)?)(?!e[-+]?\d|n\b)([A-Za-z_]\w*)/gi)) err(`${code(m[0])} isn't a number in code. A size for a style is text, "${m[0]}"; the number is ${m[1]} on its own.`);
    // one value, and this is two: "5,5" or "1, 2" (a list goes in square brackets). (ask and "show a message" take
    // several: x.several)
    const top = topMask(q), comma = top.indexOf(',');
    if (comma >= 0 && !x.several) {
      const two = q.replace(/⟦\d+⟧/g, '…').trim();
      err(/^\s*-?\d+,\d+\s*$/.test(q) ? `"${two}" is two values here, and this takes one. For a decimal, write ${two.replace(',', '.')}; for a list, put it in square brackets: [${two.replace(',', ', ')}].`
        : `"${two}" is ${top.split(',').length > 2 ? 'several values' : 'two values'} here, and this takes one. For a list, put them in square brackets: [${two}].`);
    }
    return q;
  }

  function jsExpr(src, x, inf) {
    let s = String(src || '').trim();
    if (!s) { inf.errs.push('Something is missing here: a value.'); return 'null'; }
    s = useSpaced(s, x.spaced, inf);   // (a name of several words in {…} inside text: the lines have the rest)
    const whole = jsWhole(s, x, inf);
    if (whole != null) return whole;
    // text in quotes, and regular expressions like /  +/g (a / where a value starts), are kept exactly as written;
    // a .name or […] typed right after one stays attached to it: "abc".length
    const strs = [];
    let q = s.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`|(?<=(?:^|[(,=:[!&|?{};+\-*%<>~^]|\bmatches)\s*)\/(?![/*])(?:[^/\\\n[]|\\.|\[(?:[^\]\\\n]|\\.)*\])+\/[dgimsuvy]*/g, (m, off, all) => { strs.push(m); return ` ⟦${strs.length - 1}⟧` + (/^(?:\.[A-Za-z_$]|\[)/.test(all.slice(off + m.length)) ? '' : ' '); });
    q = numbersAsWritten(q, x, inf);
    q = wholeGroups(q, strs, x, inf);
    // the keys of a record ({ equals: 1, is: 2 }) are names, never sentence words
    q = q.replace(/([{,]\s*)([A-Za-z_$][\w$]*)(?=\s*:(?!:))/g, (m, pre, k) => { strs.push(k); return `${pre}⟦${strs.length - 1}⟧`; });
    // An operand: quoted text, a number or a name (a page element's may have dashes), then any .names, calls and
    // indexes, with brackets inside brackets (see PAREN).
    const OPD = String.raw`(?:⟦\d+⟧|-?\d+(?:\.\d+)?|${nameSource(x)})(?:\.[\w$]+|${PAREN}|${SQUARE})*`;
    // An operand, or a sum in brackets, but never a sentence word ("plus trimmed" is no name)
    const OPX = String.raw`(?<![\w$.])(?!(?:plus|minus|times|divided|mod|and|or|not|is|if|otherwise|to|by|at)\b)(?:${PAREN}|${OPD})`;
    const RX = (p) => new RegExp(p.replace(/OPX/g, () => OPX).replace(/OPD/g, () => OPD), 'gi');
    const unwrap = (a) => (/^\(/.test(a) ? a.slice(1, -1).trim() : a);   // a bracketed sum, as a call's input
    // A phrase that starts with an operand ("x as text") never starts partway through one (after a .).
    const R = (p) => new RegExp(p.replace(/^\(OPD\)/, '(?<![\\w$.])(OPD)').replace(/OPD/g, () => OPD), 'gi');
    // Swaps a phrase. One that ends in an operand, like "length of x", first checks what follows it (see looseBrackets).
    const swap = (p, to) => { const re = R(p); if (p.endsWith('(OPD)')) for (const m of q.matchAll(re)) looseBrackets(m, q, strs, inf); q = q.replace(re, to); };
    const quoted = (t) => { strs.push(JSON.stringify(t)); return `⟦${strs.length - 1}⟧`; };
    q = q.replace(/\bthe\b/gi, ' ').replace(/\s+/g, ' ');   // one space between words, so "is in "abc"" reads like "is in abc"
    if (/\bwait for\b/i.test(q)) { q = q.replace(/\bwait for\b/gi, ' await '); note(inf, '`await` waits for something that finishes later (a promise) and gives back its result, without freezing the page.'); }
    // games: a key held down (with "keep track of the keys"), where a tap was, a drawing area's size
    q = q.replace(/(?:\bkey\s+)?⟦(\d+)⟧\s+is\s+(?:held(?:\s+down)?|down)\b/gi, (m, n) => {
      if (!x.vars.has('keysDown')) inf.errs.push('Keys held down need "keep track of the keys", once, near the top of Mechanics.');
      strs.push(JSON.stringify(keyName(strs[+n])));
      note(inf, '`keysDown.has(…)` is true while that key is held down, so movement keeps going for as long as you hold it.');
      return ` keysDown.has(⟦${strs.length - 1}⟧) `;
    });
    q = q.replace(/\b(?:tap|click|pointer)(?:'s)?\s+(x|y)\b/gi, (m, a) => ` event.offset${a.toUpperCase()} `);
    // (an element's id goes in as quoted text, so the names below leave it alone)
    const byId = (id) => { strs.push(`"${toId(id)}"`); return `document.getElementById(⟦${strs.length - 1}⟧)`; };
    // "the element matching "#sales tbody"", "every element matching ".card"": the page's elements by a CSS selector
    q = q.replace(/\b(every\s+)?element matching\s+⟦(\d+)⟧/gi, (m, every, n) => { note(inf, `${code(every ? 'querySelectorAll' : 'querySelector')} finds ${every ? 'every element' : 'the first element'} that the CSS selector ${code(strs[+n])} picks.`); return `document.querySelector${every ? 'All' : ''}(⟦${n}⟧)`; });
    // "the element called "total"": an element by its id, as written (for one Structure doesn't name)
    q = q.replace(/\belement called\s+⟦(\d+)⟧/gi, (m, n) => (/^["']/.test(strs[+n]) ? `document.getElementById(⟦${n}⟧)` : m));
    // "a new "li" element": a new element of that tag, not on the page yet
    q = q.replace(/\ban? new\s+⟦(\d+)⟧\s+element\b/gi, (m, n) => { if (!/^["']/.test(strs[+n])) return m; note(inf, `\`document.createElement\` makes a new ${code('<' + strOf(strs[+n]) + '>')} element; it isn't on the page until it is put somewhere.`); return `document.createElement(⟦${n}⟧)`; });
    q = q.replace(/\bpage title\b/gi, 'document.title');
    // the browser's memory, and the server's reply (both need the block to wait: see needsAsync)
    q = q.replace(RX(String.raw`\btext saved in browser as (OPX)`), (m, k) => { note(inf, '`localStorage.getItem` gives back the text saved under that name in this browser, or `null` if there is none.'); return `localStorage.getItem(${unwrap(k)})`; });
    q = q.replace(RX(String.raw`\breply from (OPX)`), (m, u) => { note(inf, '`fetch` asks the server, and `await` waits for its reply (a Response) without freezing the page.'); return `await fetch(${unwrap(u)})`; });
    q = q.replace(RX(String.raw`\b(JSON|text) read from (OPX)`), (m, w, r) => { note(inf, `\`.${w === 'JSON' ? 'json' : 'text'}()\` reads the reply's body${w === 'JSON' ? ' as JSON, into values JavaScript can use' : ' as text'}; \`await\` waits for it.`); return `await ${r}.${w === 'JSON' ? 'json' : 'text'}()`; });
    q = q.replace(R(String.raw`\b(width|height) of ([\w-]+)`), (m, wh, id) => (x.shared.ids[toId(id)] ? `${byId(id)}.${wh.toLowerCase()}` : m));
    // "text of x": a page element's text (what was typed, for a box); "value of x", "text of x" for a name holding one
    q = q.replace(R(String.raw`\btext of ([\w-]+)`), (m, id) => { const t = x.shared.ids[toId(id)]; return t ? `${byId(id)}.${/^(input|textarea|select)$/.test(t.tag) ? 'value' : 'textContent'}` : holdsElement(id, x) ? `${id}.textContent` : m; });
    q = q.replace(R(String.raw`\bvalue of (${JS_NAME})`), (m, id) => (!x.shared.ids[toId(id)] && holdsElement(id, x) ? `${id}.value` : m));
    // what was picked in a file picker
    q = q.replace(R(String.raw`\b(?:(first )?file|files) (?:in|of|from|picked in) ([\w-]+)`), (m, one, id) => ((x.shared.ids[toId(id)] || {}).type === 'file' ? `${byId(id)}.files${m.startsWith('files') ? '' : '[0]'}` : m));
    // items, innermost first: "item c of item r of grid" is grid[r][c]
    const NOT_ITEM = String.raw`(?!item OPD (?:of|in) |(?:first|last) item (?:of|in) )`;
    for (let k = 0, before; k < 8 && before !== q; k++) {
      before = q;
      swap(String.raw`\bfirst item (?:of|in) ${NOT_ITEM}(OPD)`, '$1[0]');
      // (of a tool's result: .at(-1), so the tool runs once, not twice)
      swap(String.raw`\blast item (?:of|in) ${NOT_ITEM}(OPD)`, (m, a) => (/\(/.test(a) ? `${a}.at(-1)` : `${a}[${a}.length - 1]`));
      swap(String.raw`\bitem (OPD) (?:of|in) ${NOT_ITEM}(OPD)`, '$2[$1]');
      // a worked-out position in brackets: "item ((k plus 1) mod n) of stars" is stars[(k + 1) % n]
      swap(String.raw`\bitem (${PAREN}) (?:of|in) ${NOT_ITEM}(OPD)`, (m, at, list) => `${list}[${at.slice(1, -1).trim()}]`);
    }
    // anything else between "item" and "of" isn't one position: say how to write it, never leave it half-done
    if (!x.vars.has('item') && /\bitem\s+\S.*?\s+of\s/i.test(q.replace(/⟦\d+⟧/g, ''))) inf.errs.push('The position in "item … of …" has to be one value: a number, a name, or a sum in brackets, like item (k plus 1) of stars.');
    swap(String.raw`\b(?:length|size) of (OPD)`, '$1.length');
    swap(String.raw`\bhow many (?:items )?in (OPD)`, '$1.length');
    // "a random number below 1" (Math.random()), "a random whole number below 6" (0 to 5)
    q = q.replace(RX(String.raw`\b(?:an? )?random whole number below (OPX)`), (m, n) => { note(inf, '`Math.random()` gives a decimal from 0 up to (not including) 1; times the number and rounded down, it is a whole number from 0 up to one less than it.'); return `Math.floor(Math.random() * ${n})`; })
      .replace(/\b(?:an? )?random number below 1\b/gi, 'Math.random()');
    // the largest and smallest number in a list
    q = q.replace(RX(String.raw`\b(largest|biggest|smallest) number in (OPX)`), (m, w, l) => `Math.${/^smallest$/i.test(w) ? 'min' : 'max'}(...${l})`);
    q = randomRange(q, OPD, strs, inf, s);
    swap(String.raw`\brandom item (?:from|of|in) (OPD)`, '$1[Math.floor(Math.random() * $1.length)]');
    // words that follow their value: right after a sum they could mean the last value or the whole sum
    for (const p of [String.raw`(OPD) as (?:a )?number\b`, String.raw`(OPD) as text\b`, String.raw`(OPD) in (?:capitals|uppercase)\b`, String.raw`(OPD) in lowercase\b`,
      String.raw`(OPD) read as JSON\b`, String.raw`(OPD) as JSON text\b`, String.raw`(OPD) joined by\b`, String.raw`(OPD) to (?:OPD) decimal places\b`, String.raw`(OPD) trimmed\b`, String.raw`(OPD) split at\b`, String.raw`(OPD) rounded(?: up| down)?\b`]) {
      for (const m of q.matchAll(R(p))) {
        const before = q.slice(0, m.index);
        if (!/(?:\b(?:plus|minus|times|divided by|mod)|[-+*/%])\s*$/i.test(before)) continue;
        const sum = before.replace(/⟦(\d+)⟧/g, (_, i) => strs[+i]).trim().split(/\s+(?:and|or|is|if|otherwise)\s+|[(,]/).pop();
        const e = `"${m[0].slice(m[1].length).trim()}" comes after "${sum} ${m[1]}", so it could go with just ${code(m[1])} or with all of it. Put brackets round the part you mean: (${sum} ${m[1]}) ${m[0].slice(m[1].length).trim()}.`;
        if (!inf.errs.includes(e)) inf.errs.push(e);
      }
    }
    q = q.replace(R(String.raw`(OPD) as (?:a )?number\b`), 'Number($1)').replace(R(String.raw`(OPD) as text\b`), 'String($1)');
    q = q.replace(RX(String.raw`(OPX) in (?:capitals|uppercase)\b`), '$1.toUpperCase()').replace(RX(String.raw`(OPX) in lowercase\b`), '$1.toLowerCase()');
    // text and lists: "s trimmed", "s split at ",", "xs joined by ", "", "n to 2 decimal places", JSON
    q = q.replace(RX(String.raw`(OPX) trimmed\b`), '$1.trim()').replace(RX(String.raw`(OPX) split at (OPX)`), (m, a, b) => `${a}.split(${unwrap(b)})`);
    q = q.replace(RX(String.raw`(OPX) joined by (OPX)`), (m, a, b) => { note(inf, '`.join` puts the items together as one text, with the separator between them.'); return `${a}.join(${unwrap(b)})`; });
    q = q.replace(RX(String.raw`(OPX) to (OPX) decimal places\b`), (m, a, n) => { note(inf, '`.toFixed` gives the number as text, rounded to that many decimal places.'); return `${a}.toFixed(${unwrap(n)})`; });
    q = q.replace(RX(String.raw`(OPX) read as JSON\b`), (m, a) => { note(inf, '`JSON.parse` turns JSON text back into values.'); return `JSON.parse(${unwrap(a)})`; })
      .replace(RX(String.raw`(OPX) as JSON text\b`), (m, a) => { note(inf, '`JSON.stringify` turns a value into JSON text.'); return `JSON.stringify(${unwrap(a)})`; });
    q = q.replace(RX(String.raw`(OPX) rounded( up| down)?\b`), (m, a, way) => `Math.${!way ? 'round' : /up/.test(way) ? 'ceil' : 'floor'}(${unwrap(a)})`);
    // a checkbox, and an element's groups
    q = q.replace(R(String.raw`(OPD) is not (?:ticked|checked)\b`), '!$1.checked').replace(R(String.raw`(OPD) is (?:ticked|checked)\b`), (m, a) => { note(inf, '`.checked` is true while a checkbox is ticked.'); return `${a}.checked`; });
    q = q.replace(R(String.raw`(OPD) is not in group ([\w-]+)`), (m, a, g) => `!${a}.classList.contains(${quoted(toId(g))})`)
      .replace(R(String.raw`(OPD) is in group ([\w-]+)`), (m, a, g) => { note(inf, '`classList.contains` is true when the element is in that group (has that class).'); return `${a}.classList.contains(${quoted(toId(g))})`; });
    swap(String.raw`(OPD) contains (OPD)`, '$1.includes($2)');
    // "ua matches /win/i": a regular expression's test
    q = q.replace(R(String.raw`(OPD) matches (⟦\d+⟧)`), (m, a, re) => (/^\//.test(strs[+re.slice(1, -1)]) ? `${re}.test(${a})` : m));
    swap(String.raw`(OPD) is not (?:in|one of) (OPD)`, '!$2.includes($1)');
    swap(String.raw`(OPD) is (?:in|one of) (OPD)`, '$2.includes($1)');
    // "is an empty list": a new [] is never === another list, so it's about how many items there are
    q = q.replace(R(String.raw`(OPD) is not (?:an )?empty(?: list| text)?\b`), '$1.length > 0').replace(R(String.raw`(OPD) is (?:an )?empty(?: list| text)?\b`), (m, a) => { note(inf, '`.length === 0` is true when there\'s nothing in it. (`=== []` would always be false: two lists are only `===` when they are the very same list.)'); return `${a}.length === 0`; });
    q = q.replace(/\ban empty list\b|\bempty list\b/gi, '[]').replace(/\bempty text\b/gi, '""');
    for (const [re, to] of JS_WORDS) q = q.replace(re, to);
    q = jsTwoReadings(q, OPD, strs, inf);
    q = q.replace(/(^|[^=!<>])=(?![=>])/g, (m, a) => (x.cond ? a + ' === ' : m));   // (=> is a little function, not a comparison)
    // inputs of little functions written in the value (t => t.done, (a, b) => a - b) are names too
    const params = new Set();
    for (const mm of q.matchAll(/(?:\(([^()]*)\)|([A-Za-z_$][\w$]*))\s*=>/g)) (mm[1] ?? mm[2]).split(',').map(p => p.trim().replace(/\s*=.*$/, '')).filter(Boolean).forEach(p => params.add(p));
    // names: page elements used bare become the element
    q = q.replace(/(?<![\w$.⟦])([A-Za-z_$][\w$-]*)(?![\w$⟧])/g, (m, id, off) => {
      if (params.has(id)) return id;
      if (/^(true|false|null|undefined|Math|Number|String|document|window|console|JSON|Date|localStorage|this|new|typeof|await|async|function|return|event)$/.test(id)) return id;
      if (/[{,]\s*$/.test(q.slice(0, off)) && /^\s*:(?!:)/.test(q.slice(off + m.length))) return id;   // a key in { name: value }
      if (x.vars.has(id) || x.fns.has(id)) {
        // made inside an if, otherwise or loop that has ended: in JavaScript it's gone (and "name" would be the window's)
        if (x.pass2 && x.gone.has(id) && x.inScope && !x.inScope(id) && !x.fns.has(id)) { const w = `${code(id)} is set inside a block that has ended (an if, otherwise, loop or tool above), so it doesn't exist here. Set it before that block (for example "set ${id} to 0"), then change it inside.`; if (!inf.warns.includes(w)) inf.warns.push(w); }
        return id;
      }
      const el = x.shared.ids[toId(id)];
      if (el && !x.vars.has(id)) return `document.getElementById("${toId(id)}")`;
      if (BROWSER_NAMES.test(id)) return id;
      if (x.pass2 && !/^\d/.test(id) && !/^\s*\(/.test(q.slice(off + m.length))) inf.warns.push(`${code(id)} hasn't been set anywhere yet.`);
      return id;
    });
    q = q.replace(/\s+/g, ' ').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')').replace(/\[\s+/g, '[').replace(/\s+\]/g, ']').replace(/\s+,/g, ',').replace(/!\s+/g, '!').replace(/\s*\.\s*(?=length)/g, '.').replace(/(⟧) \.(?=[A-Za-z_$])/g, '$1.').replace(/([{,] ?⟦\d+⟧) :(?!:)/g, '$1:').trim();   // { "key": value }
    // a number with a word after it ("5 dollars") is no value JavaScript can read: a problem, never that code
    for (const m of q.matchAll(/(?<![\w$.⟦⟧"'])(-?\d+(?:\.\d+)?) (?!(?:in|instanceof)\b)([A-Za-z_][\w$]*)(?![\w$(])/g)) {
      const e = `"${m[0]}" isn't a value: in code, a number can't have a word after it. Write ${m[1]}, or put it in quotes for text: "${m[0]}".`;
      if (!inf.errs.includes(e)) inf.errs.push(e);
    }
    q = q.replace(/⟦(\d+)⟧/g, (m, i) => {
      const str = strs[+i];
      if (str[0] !== '"' || !/[{}]/.test(str)) return str;
      if (!fillsIn(str)) return str.replace(/\{\{/g, '{').replace(/\}\}/g, '}');
      note(inf, 'Text with {…} inside becomes a template string (backticks): JavaScript fills in the current values. (A brace itself is written twice: {{ or }}.)');
      let body = '';
      for (const mm of str.slice(1, -1).matchAll(new RegExp(FILL.source + '|[^{}]+', 'g'))) {
        if (mm[1] != null) body += '${' + jsExpr(mm[1], x, inf) + '}';
        else if (/^[{}]/.test(mm[0])) body += (body.endsWith('$') ? '\\' : '') + mm[0][0];   // a brace itself (never the start of ${)
        else body += mm[0].replace(/`/g, '\\`');
      }
      return '`' + body + '`';
    });
    return q;
  }

  /* "left", "space", "a" -> the key names the browser uses ("ArrowLeft", " ", "a"). */
  function keyName(said) {
    const k = String(said).trim().replace(/^["'`]|["'`]$/g, '');
    const named = { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown', space: ' ', 'space bar': ' ', spacebar: ' ', enter: 'Enter', return: 'Enter', escape: 'Escape', esc: 'Escape', shift: 'Shift', tab: 'Tab' };
    return named[k.toLowerCase()] || (k.length === 1 ? k.toLowerCase() : k);
  }

  /* An element a sentence names: one from Structure (by its name), one made in Mechanics ("make a new button
     … and store in b"), or any name in Mechanics that holds an element (a tool's input, a "for each" name),
     including an item of a list of them ("item n of cells"). */
  /* Is this a Mechanics name (or an item of one, or a value inside one) that can hold an element? A name only
     ever set to a number, text or the like can't. Gives back the match, or null. */
  function holdsElement(raw, x) {
    const v = raw.match(/^(?:(?:first|last)\s+item|item\s+.+?)\s+(?:of|in)\s+([A-Za-z_$][\w$]*)$|^([A-Za-z_$][\w$]*)(?:\.[A-Za-z_$][\w$]*|\[[^\]]+\])*$/i);
    const head = v && (v[1] || v[2]);
    return head && x.vars.has(head) && !(x.plain.has(head) && !x.mixed.has(head) && v[2] === raw) ? v : null;
  }
  function elementRef(name, x, inf) {
    const raw = String(name).trim(), id = toId(raw);
    if (x.made.has(raw)) return { js: raw, id: raw, tag: x.made.get(raw), made: true };
    // its name (in any capitals: quote is "Quote"), or the text it shows, in quotes
    const real = x.shared.ids[id] ? id : ((idsByText(raw, x.shared) || [])[0] || findId(x.shared, raw));
    const el = real && x.shared.ids[real];
    if (el) return { js: `document.getElementById(${JSON.stringify(real)})`, id: real, tag: el.tag };
    // "the element called "add"", "the element matching ".go"": found on the page as the code runs
    if (/^(?:the\s+)?element (?:called|matching)\s+(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')$/i.test(raw)) return { js: jsExpr(raw, x, inf), id: raw, tag: null };
    if (/^the (?:page|document)$/i.test(raw)) return { js: 'document', id: 'the page', tag: null };
    if (/^the window$/i.test(raw)) return { js: 'window', id: 'the window', tag: null };
    const v = holdsElement(raw, x);
    if (v) return { js: v[2] === raw ? raw : jsExpr(raw, x, inf), id: raw, tag: null };
    if (x.shared.wanted && id) x.shared.wanted[id] = x.shared.wanted[id] || 'mechanics';   // Structure's Predictive Mode offers to add it
    inf.errs.push(`Nothing in Structure is called ${code(id)}. Add it there first, e.g. "add a button called ${id} saying "…"", or make it in Mechanics: "make a new button saying "…" in … and store in ${/^[A-Za-z_$][\w$]*$/.test(raw) ? raw : 'b'}".`);
    return { js: `document.getElementById("${id}")`, id, tag: null };
  }

  /* Making elements in Mechanics: "make a new button saying "Remove" in row in group remove and store in button". */
  const MADE = { button: 'button', 'list item': 'li', item: 'li', block: 'div', box: 'div', area: 'div', card: 'div', paragraph: 'p', text: 'span', link: 'a', picture: 'img', image: 'img', photo: 'img', heading: 'h2', 'big heading': 'h1', 'small heading': 'h3', section: 'section', list: 'ul', 'numbered list': 'ol', label: 'label', option: 'option', row: 'tr', cell: 'td', 'drawing area': 'canvas', canvas: 'canvas' };
  const MAKE_NEW = /^(?:make|create|add)\s+(?:a\s+|an\s+)?new\s+(big heading|small heading|list item|numbered list|drawing area|button|item|block|box|area|card|paragraph|text|link|picture|image|photo|heading|section|list|label|option|row|cell|canvas)(?=\s|$)(.*)$/i;

  /* ---- Names and numbers in Mechanics, as people type them ---- */

  // JavaScript's own words, which can't be names; words sentences read as values; names every page already has
  const JS_OWN = new Set(('break case catch class const continue debugger default delete do else enum export extends false finally for function if import in ' +
    'instanceof new null return super switch this throw true try typeof var void while with yield let static implements interface package private protected public ' +
    'await arguments eval undefined NaN Infinity').split(' '));
  const SAID_AS = { yes: 'true', no: 'false', nothing: 'null', none: 'null', plus: '+', minus: '-', times: '*', mod: '%', and: '&&', or: '||', not: '!', is: '===', equals: '===' };
  const PAGE_OWN = new Set(['window', 'document', 'location', 'top']);
  /* What is wrong with n as a new name, or null. top: made at the top of the script, outside any block. */
  function nameProblem(n, top) {
    if (JS_OWN.has(n)) return `"${n}" is one of JavaScript's own words, so it can't be a name. Try something like "my ${n}" or "${n} value".`;
    const w = SAID_AS[String(n).toLowerCase()];
    if (w) return `"${n}" is a word sentences read as ${code(w)}, so as a name it would be read that way instead. Try something like "my ${n}" or "${n} count".`;
    if (top && PAGE_OWN.has(n)) return `${code(n)} is already a name in every web page, so a script can't make it again. Try something like "my ${n}" or "${n} value".`;
    return null;
  }

  /* "1,000" is the number 1000: in code, the comma would make it two values. Where commas also separate values
     (show, add, draw, with …), only a group that can't be two numbers is taken (1,000: "000" is no number), and
     "1,500" there is a problem asking which is meant. Inside brackets, "1,500" is left as written (a list). */
  const QUOTED_OR_REGEX = new RegExp(String.raw`"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|` + '`(?:[^`\\\\]|\\\\.)*`|' + REGEX_LITERAL.source, 'g');
  function digitGroups(line, inf) {
    if (!/\d,\d{3}/.test(line)) return line;
    const masked = line.replace(QUOTED_OR_REGEX, (q) => '\u0001'.repeat(q.length));
    const several = /^\s*(?:show|add|draw|create|make|bring in)\b|\b(?:with|using)\s/i;
    let out = '', last = 0;
    for (const m of masked.matchAll(/(?<![\w.,])(\d{1,3}(?:,\d{3})+)(\.\d+)?(?![\w$]|,\d)/g)) {
      let depth = 0;
      for (const c of masked.slice(0, m.index)) { if ('([{'.includes(c)) depth++; else if (')]}'.includes(c)) depth = Math.max(0, depth - 1); }
      const n = m[1].replace(/,/g, '') + (m[2] || ''), zero = m[1].split(',').slice(1).some(g => g[0] === '0');
      if (!zero && (depth || several.test(masked.slice(0, m.index)))) {
        if (!depth) inf.errs.push(`"${m[0]}" could be one number (${n}) or ${m[1].split(',').length > 2 ? 'several' : 'two'} (${m[1].split(',').join(', ')}). Write ${n} for one, or put a space after ${m[1].split(',').length > 2 ? 'each' : 'the'} comma.`);
        continue;
      }
      note(inf, `${code(m[0])} is written ${code(n)} in code: a comma there would split it in two.`);
      out += line.slice(last, m.index) + n; last = m.index + m[0].length;
    }
    return out + line.slice(last);
  }

  /* Names of several words ("total price") or with dashes ("high-score") are one JavaScript name, in camelCase
     (totalPrice, highScore), on every line of the file. A name can't have a word sentences use for something else
     ("number of lives": of), start like a phrase ("random number"), or be an element's name in Structure. */
  const NAME_STOP = new Set("of to in into onto is isn't are was were and or not plus minus times divided by mod with from at as if then otherwise else for each every any where a an the than equals called matching using".split(' '));
  const PHRASE_HEADS = /^(?:(?:first|last|random) item|random (?:number|whole)|(?:largest|biggest|smallest) number|how many|page title|empty (?:list|text)|(?:tap|click|pointer) [xy])\b/i;
  const SPACED = String.raw`[A-Za-z_$][\w$]*(?:(?:\s+|-)[\w$]+)+?`;
  const camel = (words) => words.map((w, k) => (k ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase())).join('');
  const wordsOf = (said) => String(said).trim().replace(/^the\s+/i, '').split(/\s+|-/).filter(Boolean);
  /* Why these words can't be one name, or null (and null for one word: that is a name already). */
  function spacedProblem(said, shared) {
    const ws = wordsOf(said), t = ws.join(' ');
    if (ws.length < 2) return null;
    if (/^\d/.test(ws[0])) return `A name can't start with a number, so "${t}" can't be one. Put a word before it, like "my ${t}".`;
    const stop = ws.find(w => NAME_STOP.has(w.toLowerCase()));
    if (stop) return `"${t}" can't be a name: sentences read "${stop}" as part of a phrase. Say it in one word, like ${camel(ws)}, or in other words.`;
    const head = t.match(PHRASE_HEADS);
    if (head) return `"${t}" starts like the phrase "${head[0]} …", so it can't be a name. Try something like "my ${t}".`;
    if (!ws.every(w => /^[\w$]+$/.test(w))) return `"${t}" can't be a name: names use letters, numbers and spaces.`;
    if (shared.ids[toId(t)] || shared.ids[ws.join('-')]) return `"${t}" is the name of an element in Structure, so a value can't have it too. To change what it shows: set the text of ${t} to …. For a value, use another name, like "${t} value".`;
    return null;
  }
  /* The names of several words made in these lines: [{ js, re }], longest first. */
  function spacedNames(lines, shared) {
    const said = new Map();
    const P = [
      new RegExp(String.raw`^(?:set|let)\s+(?:the\s+)?(${SPACED})\s+(?:to|be)\s`, 'i'),
      new RegExp(String.raw`^make\s+(?!(?:an?\s+)?new\s)(?:the\s+)?(${SPACED})\s+(?:to|be)\s`, 'i'),
      new RegExp(String.raw`^constant\s+(?:the\s+)?(${SPACED})\s+(?:is|=)\s`, 'i'),
      new RegExp(String.raw`^(?:create|make)\s+(?:an?\s+)?(?:new\s+)?(?:empty\s+)?list\s+(?:called\s+)?(${SPACED})(?:\s+with\s|$)`, 'i'),
      new RegExp(String.raw`\band store (?:it |the reply |the result |the answer )?in\s+(${SPACED})$`, 'i'),
      new RegExp(String.raw`^(?:do this )?for each\s+(${SPACED})\s+in\s`, 'i'),
      new RegExp(String.raw`(?:\bseconds?|\bfails|with the event|^load (?:the |a )?(?:picture|image)\s.+?)\s+as\s+(${SPACED})$`, 'i'),
      new RegExp(String.raw`\bcounting with\s+(${SPACED})$`, 'i'),
    ];
    for (const raw of lines) {
      if (/^\s*(?:js|javascript|raw|note|comment|description)\s*:/i.test(raw)) continue;
      const s = raw.trim().replace(/[.:]$/, '').replace(FILLER, '').replace(QUOTED_OR_REGEX, (q) => '\u0001'.repeat(q.length));
      const found = [];
      for (const re of P) { const m = s.match(re); if (m) found.push(m[1]); }
      let d;
      if ((d = s.match(/^define\s+(?!(?:a\s+)?class\b)(.+?)(?:\s+using\s+(.+))?$/i))) { found.push(d[1]); if (d[2]) found.push(...d[2].split(/\s*,\s*/).map(p => p.replace(/\s*=.*$/, ''))); }
      if ((d = s.match(/^when (?:a )?new\s+\S+\s+is (?:made|created)\s+(?:with|using)\s+(.+)$/i))) found.push(...d[1].split(/\s*,\s*/).map(p => p.replace(/\s*=.*$/, '')));
      for (const f of found) {
        const ws = wordsOf(f);
        if (ws.length > 1 && !spacedProblem(f, shared)) said.set(ws.map(w => w.toLowerCase()).join(' '), ws);
      }
    }
    const esc = (w) => w.replace(/[$]/g, '\\$');
    return [...said.values()].sort((a, b) => b.join(' ').length - a.join(' ').length).map(ws => ({
      js: camel(ws), re: new RegExp(`${/^new$/i.test(ws[0]) ? String.raw`(?<!\ban?\s+)` : ''}(?<![\\w$.-])${ws.map(esc).join('[\\s-]+')}(?![\\w$-])`, 'gi'),
    }));
  }
  /* The line with each name of several words written as its JavaScript name, outside quotes, saying so. */
  function useSpaced(line, names, inf) {
    if (!names || !names.length) return line;
    const done = [];
    const out = outsideQuotes(line, (t) => { for (const n of names) t = t.replace(n.re, (m) => { done.push([m, n.js]); return n.js; }); return t; });
    for (const [said, js] of done) note(inf, /\s/.test(said) ? `JavaScript names can't have spaces, so "${said}" is written ${code(js)}.` : `JavaScript names can't have dashes (a dash is a minus), so "${said}" is written ${code(js)}.`);
    return out;
  }

  /* ext (optional): a dialect built on these sentences (TypeScript, React: lang/ts_write.js).
       ext.plain(s)            the sentence as these sentences say it (its types left out), for learning names; '' for
                               one of its own that makes no name these sentences know; or null (it's one of these)
       ext.names(s, x)         pass 1: the names a line of its own makes
       ext.line(s, ctx)        pass 2: write a line of its own (true), leave it to these sentences (false), or say it
                               as one of these ({ s }) and then change the code it made ({ s, patch(out, at) }: the
                               lines from out[at] on are this line's)
       ext.expr(s, x, inf, E)  a value of its own (its JavaScript), or null */
  function compileJs(sec, shared, ext) {
    // (JavaScript's own dialect when none is given: React's sentences for JSX, and shared parts; see lang/ts_write.js)
    if (ext === undefined) ext = root.IntuiTs ? root.IntuiTs.ext('js') : null;
    // (a tab at the start of a line counts as 4 spaces, as in the other writers; exact lines keep their own)
    const given = sec.text.split('\n');
    let lines = given.map(l => l.replace(/^[ \t]+/, (w) => w.replace(/\t/g, '    ')));
    const info = makeInfo(lines);
    // exact code (js: …), and the blank lines between exact lines, which are the code's own (see the end)
    const EXACT = /^[ \t]*(?:js|javascript|raw)\s*:/i;
    const exactBlank = blanksBetween(lines, (l) => EXACT.test(l));
    // in a file that ends in exact code, the newline at its end ends that code: it isn't a blank line of its own
    let lastSolid = lines.length - 1;
    while (lastSolid >= 0 && !lines[lastSolid].trim()) lastSolid--;
    const endNewline = lastSolid >= 0 && lastSolid < lines.length - 1 && EXACT.test(lines[lastSolid]) ? lines.length - 1 : -1;
    // sentences as people type them (not exact code, or notes): curly quotes, "1,000", names of several words
    const RAW_JS = /^\s*(?:js|javascript|raw|note|comment|description)\s*:/i;
    lines = lines.map((l, i) => { if (RAW_JS.test(l)) return l; const st = straightQuotes(l, true); if (st !== l) note(info[i], CURLY_NOTE); return digitGroups(st, info[i]); });
    // (a dialect's lines are read as the sentences they stand for: "define shared add" makes the name add, not sharedAdd)
    const plainLine = (l) => { const p = ext && ext.plain ? ext.plain(l.trim()) : null; return p == null ? l : l.match(/^\s*/)[0] + p; };
    const spaced = spacedNames(ext && ext.plain ? lines.map(plainLine) : lines, shared);
    lines = lines.map((l, i) => (RAW_JS.test(l) ? l : useSpaced(l, spaced, info[i])));
    const out = [];
    const push = (text, src) => out.push({ text, src });
    const x = { shared, vars: new Set(), fns: new Set(), pass2: false, cond: false, made: new Map(), timers: new Map(), plain: new Set(), mixed: new Set(), kinds: new Map(), gone: new Set(), spaced, ext: ext || null };
    // what a name holds, from the values it's set to: number, text, list, record, yes/no, or mixed (different ones)
    const kindOfValue = (v) => (/^[$€£¥]?-?\d/.test(v) ? 'number' : /^["'`]|^empty text\b/i.test(v) ? 'text' : /^\[|^(?:an )?empty list\b/i.test(v) ? 'list' : /^\{/.test(v) ? 'record' : /^(?:yes|no|true|false)\b/i.test(v) ? 'yesno' : null);
    const setKind = (n, k) => { if (!k) return; const had = x.kinds.get(n); x.kinds.set(n, !had || had === k ? k : 'mixed'); };
    // pass 1: names
    for (const raw of lines) {
      const s = plainLine(raw).trim();
      let m;
      if ((m = s.match(/^(?:set|let|make)\s+(?:the\s+)?([A-Za-z_$][\w$]*)\s+(?:to|be)\s+(.*)$/i)) || (m = s.match(/^constant\s+(?:the\s+)?([A-Za-z_$][\w$]*)\s+(?:is|=)\s+(.*)$/i))) {
        x.vars.add(m[1]);
        setKind(m[1], kindOfValue(m[2]));
        // a name only ever set to a number, text, yes/no, a list or a record never holds an element ("hide score" stays a mistake)
        (/^(?:[$€£¥]?-?\d|["'`[{]|(?:yes|no|true|false|nothing|empty text|an empty list|empty list)\b)/i.test(m[2]) ? x.plain : x.mixed).add(m[1]);
      }
      if ((m = s.match(/^(?:create|make)\s+(?:an?\s+)?(?:new\s+)?(?:empty\s+)?list\s+(?:called\s+)?([A-Za-z_$][\w$]*)(?:\s+with\s|$)/i))) { x.vars.add(m[1]); setKind(m[1], 'list'); }
      if ((m = s.match(/^ask\s+.+?\s+and store (?:it )?in\s+([A-Za-z_$][\w$]*)$/i))) setKind(m[1], 'text');
      if ((m = s.match(/\band store (?:it |the reply )?in\s+([A-Za-z_$][\w$]*)$/i))) x.vars.add(m[1]);
      if ((m = s.match(/^for each\s+([A-Za-z_$][\w$]*)\s+in\s/i))) x.vars.add(m[1]);
      if (/^keep track of (?:the )?keys$/i.test(s)) x.vars.add('keysDown');
      if ((m = s.match(/^when\s+.+?,?\s+with the event as\s+([A-Za-z_$][\w$]*)[.:]?$/i))) x.vars.add(m[1]);
      if ((m = s.match(/^load (?:the |a )?(?:picture|image)\s+.+?\s+(?:as|called)\s+([A-Za-z_$][\w$]*)$/i))) { x.vars.add(m[1]); x.pictures = (x.pictures || new Set()).add(m[1]); }
      if ((m = s.match(/^define\s+([A-Za-z_$][\w$]*)(?:\s+using\s+(.+))?$/i))) { x.fns.add(m[1]); if (m[2]) m[2].split(/\s*,\s*/).forEach(p => x.vars.add(p.replace(/\s*=.*$/, ''))); }   // (greeting = "hi": the name is greeting)
      if ((m = s.match(/^when (?:a )?new\s+[A-Za-z_$][\w$]*\s+is (?:made|created)\s+(?:with|using)\s+(.+)$/i))) m[1].split(/\s*,\s*/).forEach(p => x.vars.add(p.replace(/\s*=.*$/, '')));
      if ((m = s.match(/^define (?:a )?class\s+([A-Za-z_$][\w$]*)/i))) x.vars.add(m[1]);
      if ((m = s.match(/^(?:constant|set)\s+([A-Za-z_$][\w$]*)\s+(?:is|to)\s+a tool(?:\s+using\s+(.+?))?(?:\s+giving back\s.+)?$/i))) { x.fns.add(m[1]); if (m[2]) m[2].split(/\s*,\s*/).forEach(p => x.vars.add(p.replace(/\s*=.*$/, ''))); }
      if ((m = s.match(/^do this for each\s+([A-Za-z_$][\w$]*)\s+in\s+.+?(?:,?\s+counting with\s+([A-Za-z_$][\w$]*))?$/i))) { x.vars.add(m[1]); if (m[2]) x.vars.add(m[2]); }
      if ((m = s.match(/^bring in\s+(.+?)\s+from\s+["']/i))) m[1].split(/\s*,\s*|\s+and\s+/).forEach(n => x.vars.add(n.trim()));
      if ((m = s.match(MAKE_NEW)) && (m = m[2].match(/\band store (?:it )?in\s+([A-Za-z_$][\w$]*)$/i))) x.made.set(m[1], MADE[s.match(MAKE_NEW)[1].toLowerCase().replace(/\s+/g, ' ')]);
      if ((m = s.match(/^(every|after)\s+.+?\s+seconds?\s+as\s+([A-Za-z_$][\w$]*)[.:]?$/i))) { x.vars.add(m[2]); x.timers.set(m[2], /^every$/i.test(m[1]) ? 'Interval' : 'Timeout'); }
      if ((m = s.match(/^(?:if|when) (?:it|that|this|anything|something) fails\s+as\s+([A-Za-z_$][\w$]*)[.:]?$/i))) x.vars.add(m[1]);
      // exact code (js: …) makes names too: function f(a, b), let / const / var x, for (const p of …), catch (e)
      if ((m = s.match(/^(?:js|javascript|raw)\s*:\s?(.*)$/i))) {
        const c = m[1];
        let d;
        if ((d = c.match(/^(?:export\s+)?(?:async\s+)?function\*?\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)/))) { x.fns.add(d[1]); d[2].split(',').forEach(p => { const n = p.trim().replace(/^\.\.\./, '').replace(/\s*=.*$/, ''); if (/^[A-Za-z_$][\w$]*$/.test(n)) x.vars.add(n); }); }
        for (const v of c.matchAll(/\b(?:let|const|var)\s+([A-Za-z_$][\w$]*)/g)) x.vars.add(v[1]);
        if ((d = c.match(/\bcatch\s*\(\s*([A-Za-z_$][\w$]*)/))) x.vars.add(d[1]);
        if ((d = c.match(/^(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/))) x.fns.add(d[1]);
        // import express, { Request as Req, type Note } from "…", import * as React from "…": the names it brings in
        if ((d = c.match(/^import\s+(?:type\s+)?([^'"]+?)\s+from\s+["']/))) {
          for (const part of d[1].replace(/[{}]/g, ',').split(',')) {
            const n = part.trim().replace(/^type\s+/, '').split(/\s+as\s+/).pop().trim();
            if (/^[A-Za-z_$][\w$]*$/.test(n)) x.vars.add(n);
          }
        }
      }
      if ((m = s.match(/^(?:js|javascript|raw)\s*:(.*)$/i))) {
        for (const d of m[1].matchAll(/\b(?:let|const|var)\s+([A-Za-z_$][\w$]*)/g)) x.vars.add(d[1]);
        for (const d of m[1].matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)/g)) x.vars.add(d[1]);
      }
      if (ext && ext.names) ext.names(raw.trim(), x);
    }
    x.pass2 = true;
    const scopes = [new Map()];   // name -> 'let' | 'const', one map per block, like JavaScript
    const known = (n) => scopes.some(sc => sc.has(n));
    const isConst = (n) => { for (let k = scopes.length - 1; k >= 0; k--) if (scopes[k].has(n)) return scopes[k].get(n) === 'const'; return false; };
    // a name a sentence makes that can't be one (class, yes, top at the top of the script…) is a problem, as in
    // Python; sayer: the line's info while a sentence is read (exact code, js:, is the person's own)
    let sayer = null;
    const declare = (n, kind = 'let') => {
      const p = sayer && nameProblem(n, stack.length === 0);
      if (p && !sayer.errs.includes(p)) sayer.errs.push(p);
      scopes[scopes.length - 1].set(n, kind);
    };
    x.inScope = known;   // (so a value can tell a name whose block has ended: x.gone)
    /* The keyword for storing in a name: '' when it already exists (a constant can't change), else let or const. */
    const keyword = (n, inf, kind = 'let') => {
      if (known(n)) { if (isConst(n)) inf.errs.push(`${code(n)} is a constant (made with const), so it can't be changed. Use "set ${n} to …" where it is made if it needs to change.`); return ''; }
      declare(n, kind);
      return kind + ' ';
    };
    /* Does a later line in the same block (or a block inside it) store something new in this name?
       body: only look at the block that starts under line i. */
    const changes = (line, n) => {
      const t = line.trim().replace(FILLER, '').replace(/[.:]$/, ''), e = n.replace(/\$/g, '\\$');
      const r = t.match(/^(?:js|javascript|raw)\s*:(.*)$/i);
      if (r) return new RegExp(`(?<![\\w$.])${e}\\s*(?:[-+*/%&|^]|\\*\\*|<<|>>>?|&&|\\|\\||\\?\\?)?=(?!=)|(?<![\\w$.])${e}\\s*(?:\\+\\+|--)|(?:\\+\\+|--)\\s*${e}(?![\\w$])`).test(r[1].replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/g, '""'));
      return new RegExp(`^(?:(?:set|let|make)\\s+${e}\\s+(?:to|be)\\s|(?:increase|decrease|multiply|divide)\\s+${e}(?:\\s|$)|(?:create|make)\\s+(?:an?\\s+)?(?:empty\\s+)?list\\s+(?:called\\s+)?${e}(?:\\s|$))|\\band store (?:it |the reply |the result )?in\\s+${e}$`, 'i').test(t);
    };
    const changedLater = (i, n, body) => {
      const base = lines[i].match(/^ */)[0].length;
      for (let j = i + 1; j < lines.length; j++) {
        if (!lines[j].trim()) continue;
        const ind = lines[j].match(/^ */)[0].length;
        if (body ? ind <= base : ind < base) break;
        if (changes(lines[j], n)) return true;
      }
      return false;
    };
    const stack = [];   // {ind, close, kind}
    // (several: the value can be several, as a call's inputs: ask "…", default)
    const E = (t, inf, cond, several) => { x.cond = !!cond; x.several = !!several; const r = jsExpr(t, x, inf); x.cond = false; x.several = false; return r; };
    const usesEvent = (fromIdx) => { // does the block starting after this line use the event?
      const baseInd = lines[fromIdx].match(/^ */)[0].length;
      for (let j = fromIdx + 1; j < lines.length; j++) { if (!lines[j].trim()) continue; if (lines[j].match(/^ */)[0].length <= baseInd) break; if (/\bevent\b/.test(lines[j].replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, ''))) return true; }
      return false;
    };
    /* Does the block starting after this line wait for something (fetch, send, wait for, or running a tool
       that does)? Then it has to be async. */
    const needsAsync = (fromIdx, seen = new Set()) => {
      const baseInd = lines[fromIdx].match(/^ */)[0].length;
      let inner = null;   // a block inside this one that is a function of its own (when …, every …, define …): its waiting is its own
      for (let j = fromIdx + 1; j < lines.length; j++) {
        if (!lines[j].trim()) continue;
        const jInd = lines[j].match(/^ */)[0].length;
        if (jInd <= baseInd) break;
        if (inner != null && jInd > inner) continue;
        inner = /^\s*(?:when |every |after |define |do this for each |(?:constant|set) [A-Za-z_$][\w$]* (?:is|to) a tool\b)/i.test(lines[j]) ? jInd : null;
        if (inner != null) continue;
        if (/\b(fetch|send .+ to)\b/i.test(lines[j])) return true;
        if (/^\s*(?:note|comment)\s*:/i.test(lines[j])) continue;
        if (/\bwait for\b|\breply from\b|\b(?:JSON|text) read from\b/i.test(lines[j].replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, '""'))) return true;
        const r = lines[j].trim().replace(FILLER, '').match(/^run\s+([A-Za-z_$][\w$]*)(?=\s|$)/i);
        if (r && x.fns.has(r[1]) && !/\swithout waiting(?:\s|$)/i.test(lines[j]) && fnIsAsync(r[1], seen)) return true;
        // exact code that waits (await) needs it too, unless it makes a function of its own there
        const c = lines[j].match(/^\s*(?:js|javascript|raw)\s*:(.*)$/i), code = c && c[1].replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/g, '""');
        if (code && /\bawait\b/.test(code) && !rawAsyncIn(fromIdx)) return true;
      }
      return false;
    };
    const rawAsyncIn = (fromIdx) => {   // an async function written in exact code inside this block
      const baseInd = lines[fromIdx].match(/^ */)[0].length;
      for (let j = fromIdx + 1; j < lines.length; j++) {
        if (!lines[j].trim()) continue;
        if (lines[j].match(/^ */)[0].length <= baseInd) break;
        if (/^\s*(?:js|javascript|raw)\s*:.*\basync\b/i.test(lines[j])) return true;
      }
      return false;
    };
    const fnIsAsync = (name, seen = new Set()) => {
      if (seen.has(name)) return false;
      const idx = lines.findIndex(l => new RegExp(`^\\s*define\\s+${name.replace(/\$/g, '\\$')}(?:\\s|$)`, 'i').test(l));
      return idx >= 0 && needsAsync(idx, new Set([...seen, name]));
    };
    const insideFn = () => stack.some(b => b.kind === 'fn');
    // a case of "depending on" ends with break, unless its last step leaves anyway or it goes on into the next case
    const closeOf = (b) => [].concat(typeof b.close === 'function' ? b.close() : b.close);
    const caseEnd = (b) => () => { const last = out[out.length - 1]; return b.fall || (last !== b.head && /^\s*(?:return\b|break;|continue;|throw\b)/.test(last.text)) ? [] : ['  break;']; };
    let inTemplate = null;   // (exact code: a template literal that carries on to the next line, see templateOpenAfter)
    const FAILS = /^(?:if|when) (?:it|that|this|anything|something) fails\b/i, FINALLY = /^(?:finally|in any case|either way|whatever happens)[.:]?$/i;
    let skipTo = -1, patch = null;   // (lines a dialect's line took in with it, and its change to the code made: see ext.line)
    const patched = () => { if (patch) { const p = patch; patch = null; p.fn(out, p.at); } };
    lines.forEach((raw, i) => {
      patched();
      if (i <= skipTo) return;
      const inf = info[i];
      sayer = /^\s*(?:js|javascript|raw)\s*:/i.test(raw) ? null : inf;
      if (!raw.trim()) { if (i !== endNewline) out.push({ text: '', src: i, kept: exactBlank.has(i) }); return; }
      const ind = raw.match(/^ */)[0].length;
      while (stack.length && ind <= stack[stack.length - 1].ind) {
        const b = stack.pop();
        const t = raw.trim();
        const nextIsElse = ind === b.ind && ((/^(otherwise|else)\b/i.test(t) && b.kind === 'if') || (FAILS.test(t) && b.kind === 'try') || (FINALLY.test(t) && (b.kind === 'try' || b.kind === 'catch')));
        // names made inside a block are gone once it ends (JavaScript's let): remember them, to say so if used after
        if (nextIsElse) { stack.push(b); for (const n of scopes[scopes.length - 1].keys()) x.gone.add(n); scopes[scopes.length - 1] = new Map(); break; }
        for (const n of scopes.pop().keys()) x.gone.add(n);
        while (out.length && out[out.length - 1].text === '') out.pop();
        for (const c of closeOf(b)) push('  '.repeat(stack.length) + c, b.src);
      }
      const pad = '  '.repeat(stack.length);
      const open = (head, close, kind, extra = {}) => { push(pad + head, i); stack.push({ ind, close, kind, src: i, head: out[out.length - 1], ...extra }); scopes.push(new Map()); };
      const say = (t) => push(pad + t, i);
      let m;
      if ((m = given[i].match(/^([ \t]*)(?:js|javascript|raw)\s*:\s?(.*?)\r?$/i))) {
        const d = m[2].match(/^(let|const|var)\s+([A-Za-z_$][\w$]*)/);
        if (d && !inTemplate) declare(d[2], d[1] === 'const' ? 'const' : 'let');   // so a later "set …" changes it instead of making it again
        note(inf, 'Raw JavaScript: copied exactly as written.');
        // outside every sentence block it keeps its own indentation (code written as code, as Unity mode and an
        // imported file have it); inside one it's indented to fit the block
        const code = (stack.length ? '' : m[1]) + m[2];
        // a line inside a template literal (`…` over several lines) is its text: copied without the block's indent
        const was = inTemplate;
        inTemplate = templateOpenAfter(m[2], inTemplate);
        return push(was ? code : pad + code, i);
      }
      inTemplate = null;
      // a description: what a tool is for, written as a JSDoc comment just above its function
      if ((m = raw.trim().match(/^description\s*:\s?(.*)$/i))) {
        const b = stack[stack.length - 1];
        if (b && b.def && out[out.length - 1] === b.head) {
          const at = out.indexOf(b.head), p = b.head.text.match(/^ */)[0];
          if (!b.doc) { out.splice(at, 0, { text: p + '/**', src: i }, { text: p + ' */', src: i }); b.doc = true; }
          out.splice(out.indexOf(b.head) - 1, 0, { text: (p + ' * ' + m[1]).replace(/\s+$/, ''), src: i });
          note(inf, 'A description: a comment starting with `/**` just above the function (JSDoc). It says what the tool is for, and editors show it wherever the tool is used.');
          return;
        }
        note(inf, 'A description: a comment starting with `/**` (JSDoc). Right under "define …", it describes that tool.');
        return say(`/** ${m[1]} */`);
      }
      let s = raw.trim().replace(/[.:]$/, '');
      const lead = s.match(FILLER);
      if (lead && lead[0].length < s.length) { note(inf, `Left out filler: "${lead[0].trim()}".`); s = s.slice(lead[0].length); }
      if ((m = s.match(/^(?:note|comment)\s*:\s*(.*)$/i))) return say('// ' + m[1]);
      const M = (re) => qmatch(s, re);   // like s.match, but sentence words inside quotes never count
      // an address in quotes, as a link takes it: "google.com" is "https://google.com" (see address)
      const addressed = (t) => { const q = strOf(t); if (q == null) return E(t, inf); const a = address(q, 'href'); if (!a.note) return E(t, inf); note(inf, a.note); return JSON.stringify(a.value); };
      const handler = (target, ev, args = '(event)') => `${target}.addEventListener("${ev}", ${needsAsync(i) ? 'async ' : ''}${args} => {`;
      // a dialect's own sentences (TypeScript's types, React's components): it writes the line, or leaves it to these
      if (ext && ext.line) {
        const own = ext.line(s, {
          i, raw, ind, inf, pad, lines, info, x, stack, out, E: (t, cond, several) => E(t, inf, cond, several), M, say, push, open, declare, keyword, known, isConst,
          needsAsync: () => needsAsync(i), changedLater: (n, body) => changedLater(i, n, body), insideFn, skip: (j) => { skipTo = Math.max(skipTo, j); },
        });
        if (own === true) return;
        if (own && typeof own.s === 'string') { s = own.s; if (own.patch) patch = { at: out.length, fn: own.patch }; }
      }
      // --- events
      if ((m = M(/^when\s+(?:the\s+)?page (?:has )?(?:loaded|opens|starts)$/i))) {
        note(inf, 'Runs the indented lines once the page has finished loading.');
        return open(handler('document', 'DOMContentLoaded', '()'), '});', 'fn');
      }
      if ((m = M(/^when (?:a|any) key is pressed$/i))) {
        note(inf, 'A `keydown` listener on the whole page: `event.key` is the key that was pressed ("ArrowLeft", " " for space, "a").');
        return open(handler('document', 'keydown'), '});', 'fn');
      }
      if ((m = M(/^when (?:the )?key\s+(.+?)\s+is (pressed|released|let go)$/i))) {
        const k = keyName(m[1]), up = !/^pressed$/i.test(m[2]);
        note(inf, up ? `Runs once each time ${code(JSON.stringify(k))} is let go (\`keyup\`).` : `Runs once each time ${code(JSON.stringify(k))} is pressed. To move while a key is held down, use "if … is held" inside "every frame" instead.`);
        open(handler('document', up ? 'keyup' : 'keydown'), '});', 'fn');
        push('  '.repeat(stack.length) + `if (event.key !== ${JSON.stringify(k)}) return;`, i);
        return;
      }
      if ((m = M(/^when (?:the )?(?:screen|page|mouse|pointer|finger) is (tapped|touched|released|let go|lifted)$/i))) {
        if (/^(?:tapped|touched)$/i.test(m[1])) {
          note(inf, '`pointerdown` happens for a finger and for a mouse button alike, so the same lines work on a phone and a computer. "tap x" and "tap y" say where it was.');
          return open(handler('document', 'pointerdown'), '});', 'fn');
        }
        note(inf, '`pointerup` happens when a finger lifts or a mouse button is let go, anywhere on the page: a good place to end a drag. "tap x" and "tap y" say where.');
        return open(handler('document', 'pointerup'), '});', 'fn');
      }
      if ((m = M(/^when (?:the )?(?:pointer|mouse|finger) (?:moves|is moved)(?:\s+(?:over|on|across|in|inside)\s+(.+))?$/i))) {
        const el = m[1] ? elementRef(m[1], x, inf) : null;
        note(inf, `\`pointermove\` happens again and again as a mouse or a finger moves${el ? ` over ${code(el.id)}` : ''}, whether or not a button is down. "tap x" and "tap y" say where it is now.`);
        return open(handler(el ? el.js : 'document', 'pointermove'), '});', 'fn');
      }
      if ((m = M(/^when\s+(.+?)\s+is\s+(tapped|touched|released|let go|lifted)$/i))) {
        const el = elementRef(m[1], x, inf), up = /^(?:released|let go|lifted)$/i.test(m[2]);
        note(inf, up ? `\`pointerup\` on ${code(el.id)}: a finger lifting, or a mouse button let go, over it. "tap x" and "tap y" are measured from its top left corner.` : `\`pointerdown\` on ${code(el.id)}: a finger or a mouse. "tap x" and "tap y" are measured from its top left corner.`);
        return open(handler(el.js, up ? 'pointerup' : 'pointerdown'), '});', 'fn');
      }
      // "when everything has loaded": the window's load, after pictures and the rest (the page's own, above, comes first)
      if (/^when the window has loaded$/i.test(s)) {
        note(inf, 'The window\'s `load` happens once everything is in: pictures, styles and the rest. "when the page has loaded" is sooner, as soon as the page itself is read.');
        return open(handler('window', 'load', '()'), '});', 'fn');
      }
      // a key in one element (a box): "when a key is pressed in search, with the event as e"
      if ((m = M(/^when (?:a|any) key is (pressed|released|let go)\s+(?:in|on)\s+(.+?)(?:,?\s+with the event as\s+([A-Za-z_$][\w$]*))?$/i))) {
        const el = elementRef(m[2], x, inf), ev = /^pressed$/i.test(m[1]) ? 'keydown' : 'keyup';
        note(inf, `\`${ev}\` on ${code(el.id)}: ${m[3] || 'event'}.key is the key ("Enter", "a", "ArrowLeft").`);
        open(handler(el.js, ev, m[3] ? `(${m[3]})` : usesEvent(i) ? '(event)' : '()'), '});', 'fn');
        if (m[3]) declare(m[3]);
        return;
      }
      if ((m = M(/^when\s+(.+?)\s+is\s+(clicked|pressed|double-clicked|changed|typed in|hovered|pointed at|sent|submitted|focused|unfocused|scrolled|resized)(?:,?\s+with the event as\s+([A-Za-z_$][\w$]*))?$/i))) {
        const ev = { clicked: 'click', pressed: 'click', 'double-clicked': 'dblclick', changed: 'change', 'typed in': 'input', hovered: 'mouseenter', 'pointed at': 'mouseenter', sent: 'submit', submitted: 'submit', focused: 'focus', unfocused: 'blur', scrolled: 'scroll', resized: 'resize' }[m[2].toLowerCase()];
        const el = elementRef(m[1], x, inf);
        const isForm = ev === 'submit', evName = m[3] || 'event';
        note(inf, `${code('addEventListener("' + ev + '", …)')} runs the indented lines every time ${code(el.id)} ${ev === 'click' ? 'is clicked' : ev === 'submit' ? 'is sent' : /^(?:change|input)$/.test(ev) ? 'changes' : 'is ' + m[2].toLowerCase()}.` + (isForm ? ' `preventDefault()` stops the browser from reloading the page when the form is sent.' : '') + (el.made ? ` ${code(el.id)} is an element made in Mechanics, so the listener is added to it here, as it is made.` : ''));
        if (m[3]) note(inf, `The event (what happened: ${code(m[3] + '.target')} is the element, for one) is called ${code(m[3])} in the indented lines.`);
        open(handler(el.js, ev, m[3] ? `(${m[3]})` : isForm || usesEvent(i) ? '(event)' : '()'), '});', 'fn');
        if (m[3]) declare(m[3]);
        if (isForm) push('  '.repeat(stack.length) + `${evName}.preventDefault();`, i);
        return;
      }
      // a script's steps wrapped so its names stay its own, run straight away: (function () { … })();
      if ((m = M(/^run this now,?(?:\s+with\s+([A-Za-z_$][\w$]*)\s+set to\s+(.+?),?)?\s+keeping its names private$/i))) {
        note(inf, 'A function run as soon as it is made: the names made inside it don\'t clash with other scripts\' names.' + (m[1] ? ` Inside, ${code(m[1])} is the value given.` : ''));
        const given = m[1] ? E(m[2], inf) : '';
        open(`(function (${m[1] || ''}) {`, `})(${given});`, 'fn');
        if (m[1]) declare(m[1]);
        return;
      }
      if (/^use (?:JavaScript's )?strict rules$/i.test(s)) { note(inf, '`"use strict"` makes JavaScript stop with an error on some easy mistakes (like a name used before it is made).'); return say('"use strict";'); }
      if (/^every frame$/i.test(s)) {
        note(inf, '`requestAnimationFrame` runs the indented lines just before the screen is redrawn, usually 60 times a second, and asks for the next frame at the end.');
        return open('requestAnimationFrame(function frame() {', ['  requestAnimationFrame(frame);', '});'], 'fn');
      }
      if (/^keep track of (?:the )?keys$/i.test(s)) {
        note(inf, 'Remembers which keys are held down right now: added on `keydown`, taken out on `keyup`. A `Set` holds each key once.');
        declare('keysDown', 'const');
        say('const keysDown = new Set();');
        say('document.addEventListener("keydown", (event) => keysDown.add(event.key));');
        return say('document.addEventListener("keyup", (event) => keysDown.delete(event.key));');
      }
      // timers: "every 2 seconds", "every gap seconds", "after 3 seconds as reminder"; "stop reminder"
      if ((m = M(/^(every|after)\s+(?:(.+?)\s+)?seconds?(?:\s+as\s+([A-Za-z_$][\w$]*))?$/i)) && (m[2] || /^every$/i.test(m[1]))) {
        const repeat = /^every$/i.test(m[1]), t = (m[2] || '1').trim();
        let ms;
        if (/^\d+(?:\.\d+)?$/.test(t)) ms = String(Math.round(parseFloat(t) * 1000));
        else {
          const v = E(t, inf);
          ms = /^[\w$.]+$/.test(v) ? `${v} * 1000` : `(${v}) * 1000`;
          note(inf, `The time is worked out once, when the timer starts: changing ${code(v)} later doesn't change it. To change the speed, stop it and start it again.`);
        }
        note(inf, repeat ? '`setInterval` runs the indented lines again and again. The time is in milliseconds (1000 = 1 second).' : '`setTimeout` runs the indented lines once, after a delay in milliseconds.');
        const fn = `set${repeat ? 'Interval' : 'Timeout'}(${needsAsync(i) ? 'async ' : ''}() => {`;
        if (!m[3]) return open(fn, `}, ${ms});`, 'fn');
        const n = m[3], wasKnown = known(n), kw = keyword(n, inf);
        if (!wasKnown && stack.length) inf.warns.push(`${code(n)} is made inside this block, so only lines inside it can stop it. To stop it from anywhere, write "set ${n} to nothing" near the top first.`);
        note(inf, `\`set${repeat ? 'Interval' : 'Timeout'}\` gives back a number that names this timer; ${code(n)} keeps it, so "stop ${n}" can hand it to \`clear${repeat ? 'Interval' : 'Timeout'}\`.`);
        return open(`${kw}${n} = ${fn}`, `}, ${ms});`, 'fn');
      }
      if ((m = M(/^stop\s+(?:repeating\s+|the repeat\s+|the timer\s+)?([A-Za-z_$][\w$]*)$/i))) {
        const kind = x.timers.get(m[1]);
        if (!kind) inf.errs.push(`There's no timer called ${code(m[1])}. Name one when it starts, like: every 2 seconds as ${m[1]}`);
        note(inf, `\`clear${kind || 'Interval'}\` stops the timer, so its lines don't run again. Stopping one that has already stopped does nothing.`);
        return say(`clear${kind || 'Interval'}(${m[1]});`);
      }
      // --- the page
      // (a page element's tag picks .value or .textContent; for one found as the code runs, the word does)
      const textProp = (el, word) => (el.tag ? (/^(input|textarea|select)$/.test(el.tag) ? 'value' : 'textContent') : /^value$/i.test(word) ? 'value' : 'textContent');
      if ((m = M(/^get the (text|value) (?:of|in|from)\s+(.+?)\s+and store (?:it )?in\s+([A-Za-z_$][\w$]*)$/i))) {
        const el = elementRef(m[2], x, inf);
        const prop = textProp(el, m[1]);
        note(inf, prop === 'value' ? 'Text boxes keep what was typed in `.value`.' : '`.textContent` is the text shown inside the element.');
        return say(`${keyword(m[3], inf)}${m[3]} = ${el.js}.${prop};`);
      }
      if ((m = M(/^set the (text|value) of\s+(.+?)\s+to\s+(.+)$/i))) {
        const el = elementRef(m[2], x, inf);
        const prop = textProp(el, m[1]);
        note(inf, prop === 'value' ? '`.value` is what a box holds: what was typed, or picked.' : '`textContent` sets plain text safely: anything typed by users is shown as text, never run as code.');
        return say(`${el.js}.${prop} = ${E(m[3], inf)};`);
      }
      if ((m = M(/^set the HTML (?:of|in|inside)\s+(.+?)\s+to\s+(.+)$/i))) {
        const el = elementRef(m[1], x, inf);
        note(inf, '`innerHTML` replaces what is inside the element with this HTML. Only use it with HTML you wrote: text typed by users could run as code.');
        return say(`${el.js}.innerHTML = ${E(m[2], inf)};`);
      }
      if ((m = M(/^set the groups of\s+(.+?)\s+to\s+(.+)$/i))) {
        const el = elementRef(m[1], x, inf);
        note(inf, '`className` is all of the element\'s groups (classes) as one text, separated by spaces; this replaces them.');
        return say(`${el.js}.className = ${E(m[2], inf)};`);
      }
      if ((m = M(/^set the page(?:'s)? title to\s+(.+)$/i))) { note(inf, '`document.title` is the page title, shown on the browser tab.'); return say(`document.title = ${E(m[1], inf)};`); }
      if ((m = M(/^remove\s+(.+?)\s+from the page$/i))) { const el = elementRef(m[1], x, inf); note(inf, '`remove()` takes the element off the page.'); return say(`${el.js}.remove();`); }
      if ((m = M(/^put\s+(.+?)\s+at the end of\s+(.+)$/i))) {
        const el = elementRef(m[2], x, inf), what = elementRef(m[1], x, inf);
        note(inf, `\`appendChild\` puts ${code(what.id)} inside ${code(el.id)}, after everything already there (moving it, if it was on the page).`);
        return say(`${el.js}.appendChild(${what.js});`);
      }
      if ((m = M(MAKE_NEW)) && !(/^(?:numbered )?list$/i.test(m[1]) && /^\s+(?:called\s+)?[A-Za-z_$][\w$]*(?:\s+with\s.+)?$/i.test(m[2]))) {   // ("make a new list called scores" is a list of values)
        const kind = m[1].toLowerCase().replace(/\s+/g, ' '), tag = MADE[kind];
        let rest = m[2], mm, store = null, parent = null, text = null, href = null, src = null, alt = null;
        const cutOff = (r) => { rest = rest.slice(0, r.index) + rest.slice(r.index + r[0].length); };
        if ((mm = qmatch(rest, /\s+and store (?:it )?in\s+([A-Za-z_$][\w$]*)$/i))) { store = mm[1]; cutOff(mm); }
        const groups = kind === 'card' ? ['card'] : [];
        if ((mm = qmatch(rest, /\s+in groups?\s+([\w-]+(?:\s*(?:,|\band\b)\s*[\w-]+)*)(?=\s+in(?:to)?\s|$)/i))) { groups.push(...mm[1].split(/\s*,\s*|\s+and\s+/).map(toId).filter(g => g && !groups.includes(g))); cutOff(mm); }
        const canHold = (p) => !!x.shared.ids[toId(p)] || x.made.has(p) || !!holdsElement(p, x);
        if ((mm = qmatch(rest, /^(.*)\s+in(?:to)?\s+(\S.*?)$/i)) && canHold(mm[2].trim())) { parent = elementRef(mm[2], x, inf); rest = mm[1]; }
        if ((mm = qmatch(rest, /\s+(?:saying|showing|that says)\s+(.+)$/i))) { text = mm[1]; cutOff(mm); }
        if (kind === 'link' && (mm = qmatch(rest, /\s+to\s+(.+)$/i))) { href = mm[1]; cutOff(mm); }
        if (/^(?:picture|image|photo)$/.test(kind) && (mm = qmatch(rest, /\s+of\s+(.+?)(?:\s+described as\s+(.+))?$/i))) { src = mm[1]; alt = mm[2] || null; cutOff(mm); }
        if (/\bcalled\b/i.test(rest)) inf.errs.push('An element made in Mechanics is named at the end, with "and store in ‹name›".');
        else if (/\S/.test(rest)) inf.errs.push(`I don't understand "${rest.trim()}" here. Try: make a new ${kind} saying "…" in ‹where it goes› and store in ‹name›`);
        if (!store && !parent) inf.warns.push('The new element isn\'t put anywhere: add "in ‹name›" to put it on the page, and "and store in ‹name›" to keep hold of it.');
        const v = store || 'new' + kind.split(' ').map(w => w[0].toUpperCase() + w.slice(1)).join('');
        const kw = !store ? 'const ' : known(store) ? keyword(store, inf) : keyword(store, inf, changedLater(i, store, false) ? 'let' : 'const');
        const body = [`${kw}${v} = document.createElement("${tag}");`];
        if (text != null) body.push(`${v}.textContent = ${E(text, inf)};`);
        if (href != null) body.push(`${v}.href = ${addressed(href)};`);
        if (src != null) { body.push(`${v}.src = ${E(src, inf)};`); body.push(`${v}.alt = ${alt != null ? E(alt, inf) : '""'};`); if (alt == null) inf.warns.push('Add "described as "…"" so people using screen readers know what the picture shows.'); }
        if (groups.length) body.push(`${v}.classList.add(${groups.map(g => JSON.stringify(g)).join(', ')});`);
        if (parent) body.push(`${parent.js}.append(${v});`);
        note(inf, `Makes a new ${code('<' + tag + '>')} element (\`document.createElement\`)` + (text != null ? ', sets its text safely with `textContent`' : '') + (groups.length ? `, puts it in group ${groups.map(code).join(' and ')}` : '') + (parent ? ` and adds it to the end of ${code(parent.id)} (\`append\`)` : '') + '.' +
          (store ? ` ${code(store)} keeps hold of it, so later lines can change it or react to it ("when ${store} is clicked").` : ''));
        if (store) { for (const l of body) say(l); return; }
        say('{'); for (const l of body) push(pad + '  ' + l, i); return say('}');
      }
      if ((m = M(/^(tick|untick)\s+(.+)$/i))) {
        const el = elementRef(m[2], x, inf);
        note(inf, '`.checked` is true while a checkbox is ticked; setting it ticks or unticks the box.');
        return say(`${el.js}.checked = ${/^tick$/i.test(m[1])};`);
      }
      // --- drawing on a drawing area (a canvas), and sound
      const isCanvas = (name) => (x.shared.ids[toId(name)] || {}).tag === 'canvas';
      // a colour as Styling takes it (royal blue, fff), or a value; a word that is neither is a problem
      const colour = (t) => {
        t = t.trim();
        if (/^["'`]/.test(t) || x.vars.has(t) || !/^#?[\w-]+(?:\s+[\w-]+)*$/.test(t)) return E(t, inf);
        if (/^#/.test(t)) return JSON.stringify(t);
        const said = { notes: [], warns: [], errs: [] }, c = color(t, said);
        if (said.errs.length && /\s/.test(t)) return E(t, inf);
        for (const k of ['notes', 'errs']) for (const v of said[k]) if (!inf[k].includes(v)) inf[k].push(v);
        return JSON.stringify(c);
      };
      const draw = (el, body) => { say('{'); push(pad + `  const pen = ${el.js}.getContext("2d");`, i); for (const l of body) push(pad + '  ' + l, i); say('}'); };
      const penNote = () => note(inf, 'A drawing area is drawn on through its 2D "context", here called `pen`: set a colour, then fill a shape. Across is x, from the left; down is y, from the top.');
      if ((m = M(/^(?:clear|empty)\s+(?:the drawing area\s+)?(.+)$/i)) && isCanvas(m[1])) {
        const el = elementRef(m[1], x, inf);
        note(inf, '`clearRect` wipes the whole drawing area, ready to draw the next frame.');
        return say(`${el.js}.getContext("2d").clearRect(0, 0, ${el.js}.width, ${el.js}.height);`);
      }
      if ((m = M(/^fill\s+(.+?)\s+with\s+(.+)$/i)) && isCanvas(m[1])) {
        const el = elementRef(m[1], x, inf); penNote();
        return draw(el, [`pen.fillStyle = ${colour(m[2])};`, `pen.fillRect(0, 0, ${el.js}.width, ${el.js}.height);`]);
      }
      if ((m = M(/^draw (?:a |an )?(?:rectangle|box|square|block)\s+at\s+(.+?)\s*,\s*(.+?)\s+(?:sized|size|of size)\s+(.+?)\s+by\s+(.+?)\s+in\s+(.+?)\s+on\s+(.+)$/i))) {
        const el = elementRef(m[6], x, inf); penNote();
        return draw(el, [`pen.fillStyle = ${colour(m[5])};`, `pen.fillRect(${E(m[1], inf)}, ${E(m[2], inf)}, ${E(m[3], inf)}, ${E(m[4], inf)});`]);
      }
      if ((m = M(/^draw (?:a )?(?:circle|dot|ball)\s+at\s+(.+?)\s*,\s*(.+?)\s+(?:with (?:a )?)?radius\s+(.+?)\s+in\s+(.+?)\s+on\s+(.+)$/i))) {
        const el = elementRef(m[5], x, inf);
        note(inf, 'A circle is a path: `arc` goes round from 0 to 2π (a full turn, in radians), then `fill` colours it in.');
        return draw(el, [`pen.fillStyle = ${colour(m[4])};`, 'pen.beginPath();', `pen.arc(${E(m[1], inf)}, ${E(m[2], inf)}, ${E(m[3], inf)}, 0, Math.PI * 2);`, 'pen.fill();']);
      }
      if ((m = M(/^draw (?:the )?text\s+(.+?)\s+at\s+(.+?)\s*,\s*(.+?)(?:\s+(?:in )?size\s+(.+?))?\s+in\s+(.+?)\s+on\s+(.+)$/i))) {
        const el = elementRef(m[6], x, inf);
        note(inf, '`fillText` draws text with its left end at x and its baseline (the line letters sit on) at y.');
        const size = !m[4] ? '"16px sans-serif"' : /^\d+(?:\.\d+)?$/.test(m[4].trim()) ? `"${parseFloat(m[4])}px sans-serif"` : `\`\${${E(m[4], inf)}}px sans-serif\``;
        return draw(el, [`pen.fillStyle = ${colour(m[5])};`, `pen.font = ${size};`, `pen.fillText(${E(m[1], inf)}, ${E(m[2], inf)}, ${E(m[3], inf)});`]);
      }
      if ((m = M(/^draw (?:a )?line\s+from\s+(.+?)\s*,\s*(.+?)\s+to\s+(.+?)\s*,\s*(.+?)\s+in\s+(.+?)\s+on\s+(.+)$/i))) {
        const el = elementRef(m[6], x, inf);
        note(inf, 'A line is a path: `moveTo` the start, `lineTo` the end, then `stroke` draws it.');
        return draw(el, [`pen.strokeStyle = ${colour(m[5])};`, 'pen.lineWidth = 2;', 'pen.beginPath();', `pen.moveTo(${E(m[1], inf)}, ${E(m[2], inf)});`, `pen.lineTo(${E(m[3], inf)}, ${E(m[4], inf)});`, 'pen.stroke();']);
      }
      // pictures: loaded once (an Image), then drawn as often as needed
      if ((m = M(/^load (?:the |a )?(?:picture|image)\s+(.+?)\s+(?:as|called)\s+([A-Za-z_$][\w$]*)$/i))) {
        note(inf, 'A picture is an `Image`: setting its `src` starts loading the file. Load each one once, near the top, then draw it as often as you like. Until it has loaded, drawing it shows nothing.');
        if (!/^["'`]/.test(m[1].trim())) inf.warns.push(`Put the file name in quotes: load the picture "${m[1].trim()}" as ${m[2]}.`);
        say(`${keyword(m[2], inf, 'const')}${m[2]} = new Image();`);
        return say(`${m[2]}.src = ${E(m[1], inf)};`);
      }
      if ((m = M(/^draw\s+([A-Za-z_$][\w$]*)\s+at\s+(.+?)\s*,\s*(.+?)(?:\s+(?:sized|size|of size)\s+(.+?)\s+by\s+(.+?))?\s+on\s+(.+)$/i)) && !/^(?:a|an|the|text|line|circle|dot|ball|rectangle|box|square|block)$/i.test(m[1])) {
        if (!(x.pictures && x.pictures.has(m[1]))) inf.errs.push(`${code(m[1])} isn't a picture yet. Load it first, near the top: load the picture "images/${m[1]}.png" as ${m[1]}.`);
        const el = elementRef(m[6], x, inf);
        note(inf, '`drawImage` draws a picture with its top left corner at x, y' + (m[4] ? ', stretched to the width and height given.' : ', at its own size. Add "sized 64 by 64" to scale it.'));
        return draw(el, [`pen.drawImage(${m[1]}, ${E(m[2], inf)}, ${E(m[3], inf)}${m[4] ? `, ${E(m[4], inf)}, ${E(m[5], inf)}` : ''});`]);
      }
      if ((m = M(/^play (?:a )?note (?:of )?(.+?)\s+for\s+(.+?)\s+seconds?$/i))) {
        note(inf, 'The Web Audio API: an oscillator makes a tone at a pitch in hertz (440 is the note A), connected to the speakers, started now and stopped after the length. One sound output is shared by every note.');
        say('{');
        push(pad + '  window.sound = window.sound || new AudioContext();', i);
        push(pad + '  const note = window.sound.createOscillator();', i);
        push(pad + `  note.frequency.value = ${E(m[1], inf)};`, i);
        push(pad + '  note.connect(window.sound.destination);', i);
        push(pad + '  note.start();', i);
        push(pad + `  note.stop(window.sound.currentTime + ${E(m[2], inf)});`, i);
        return say('}');
      }
      if ((m = M(/^(?:clear|empty)\s+(.+)$/i))) {
        const el = elementRef(m[1], x, inf);
        return say(/^(input|textarea|select)$/.test(el.tag) ? `${el.js}.value = "";` : `${el.js}.replaceChildren();`);
      }
      if ((m = M(/^hide\s+(.+)$/i))) { const el = elementRef(m[1], x, inf); return say(`${el.js}.hidden = true;`); }
      if ((m = M(/^(?:reveal|unhide|show the element)\s+(.+)$/i))) { const el = elementRef(m[1], x, inf); return say(`${el.js}.hidden = false;`); }
      if ((m = M(/^put\s+(.+?)\s+in(?:to)? group\s+(.+)$/i))) { const el = elementRef(m[1], x, inf); note(inf, 'Adds a class, so the group\'s styles from Styling apply.'); return say(`${el.js}.classList.add("${toId(m[2])}");`); }
      if ((m = M(/^take\s+(.+?)\s+out of group\s+(.+)$/i))) { const el = elementRef(m[1], x, inf); return say(`${el.js}.classList.remove("${toId(m[2])}");`); }
      if ((m = M(/^(?:switch|toggle) group\s+(.+?)\s+on\s+(.+)$/i))) { const el = elementRef(m[2], x, inf); return say(`${el.js}.classList.toggle("${toId(m[1])}");`); }
      if ((m = M(/^add\s+(.+?)\s+to the (?:page )?list\s+(.+)$/i)) || ((m = M(/^add\s+(.+?)\s+to\s+([\w-]+)$/i)) && x.shared.ids[toId(m[2])] && /^(ul|ol)$/.test(x.shared.ids[toId(m[2])].tag))) {
        const el = elementRef(m[2], x, inf);
        note(inf, 'Makes a new list item (`<li>`), sets its text safely with `textContent`, and adds it to the end of the list on the page.');
        say('{');
        push(pad + '  const newListItem = document.createElement("li");', i);
        push(pad + `  newListItem.textContent = ${E(m[1], inf)};`, i);
        push(pad + `  ${el.js}.append(newListItem);`, i);
        return say('}');
      }
      if ((m = M(/^scroll to\s+(.+)$/i))) { const el = elementRef(m[1], x, inf); note(inf, '`scrollIntoView` scrolls the page until the element is visible, smoothly.'); return say(`${el.js}.scrollIntoView({ behavior: "smooth" });`); }
      if ((m = M(/^show (?:a )?message\s+(.+)$/i))) { note(inf, '`alert` shows a pop-up. For anything more than a quick test, "set the text of …" on the page is friendlier.'); return say(`alert(${E(m[1], inf, false, true)});`); }
      if ((m = M(/^(?:go to|open the page)\s+(.+)$/i))) return say(`window.location.href = ${addressed(m[1])};`);
      // --- the server and the browser's memory
      // A reply is kept with const, unless a later line in the same block changes it (then let).
      const replyKeyword = (n) => (known(n) ? keyword(n, inf) : keyword(n, inf, changedLater(i, n, false) ? 'let' : 'const'));      if ((m = M(/^(?:fetch|get|load)\s+(?:data\s+)?from\s+(.+?)\s+and store (?:it )?in\s+([A-Za-z_$][\w$]*)$/i))) {
        const kw = replyKeyword(m[2]);
        note(inf, '`fetch` asks the server for data and `await` waits for the reply without freezing the page. `.json()` turns the reply into values JavaScript can use.' + (kw === 'let ' ? ` It is kept with \`let\` because a later line changes ${code(m[2])}.` : kw === 'const ' ? ' `const` keeps the reply under this name for good.' : ''));
        return say(`${kw}${m[2]} = await (await fetch(${E(m[1], inf)})).json();`);
      }
      if ((m = M(/^send\s+(.+?)\s+to\s+(.+?)(?:\s+and store the reply in\s+([A-Za-z_$][\w$]*))?$/i))) {
        note(inf, 'Sends the data to the server as JSON with a POST request.');
        const call = `await fetch(${E(m[2], inf)}, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(${E(m[1], inf)}) })`;
        if (m[3]) return say(`${replyKeyword(m[3])}${m[3]} = await (${call}).json();`);
        return say(call + ';');
      }
      if ((m = M(/^save\s+(.+?)\s+in the browser as\s+(.+)$/i))) { note(inf, '`localStorage` keeps data in this browser, even after the page is closed. It is stored as text, so `JSON.stringify` turns values into text.'); return say(`localStorage.setItem(${E(m[2], inf)}, JSON.stringify(${E(m[1], inf)}));`); }
      if ((m = M(/^load\s+(.+?)\s+from the browser and store (?:it )?in\s+([A-Za-z_$][\w$]*)$/i))) return say(`${keyword(m[2], inf)}${m[2]} = JSON.parse(localStorage.getItem(${E(m[1], inf)}));`);
      // --- things that finish later, and things that can fail (same sentences as Python)
      if ((m = M(/^wait for\s+(.+?)(?:\s+and store (?:it |the result |the answer )?in\s+([A-Za-z_$][\w$]*))?$/i))) {
        if (!insideFn()) inf.errs.push('"wait for" only works inside a block that runs later: "when …", "every …" or "define …".');
        note(inf, '`await` waits for something that finishes later (a promise), like copying, playing a sound or asking a server, without freezing the page. If it can fail, put it under "try", with "if it fails" after.');
        // "wait for navigator.clipboard.writeText with text": a call, said the way "run" says one
        const e = E(new RegExp(`^${JS_PATH}\\s+with\\s+\\S`, 'i').test(m[1]) ? 'the result of ' + m[1] : m[1], inf);
        const v = /^await\s/.test(e) ? e : `await ${e}`;
        return say(m[2] ? `${replyKeyword(m[2])}${m[2]} = ${v};` : v + ';');
      }
      if (/^try$/i.test(s)) {
        note(inf, '`try` runs the indented lines and watches for errors. What to do if one happens goes in "if it fails", at the same indent.');
        return open('try {', '}', 'try');
      }
      if ((m = M(/^(?:if|when) (?:it|that|this|anything|something) fails(?:\s+as\s+([A-Za-z_$][\w$]*))?$/i))) {
        const b = stack[stack.length - 1];
        if (!b || b.kind !== 'try' || b.ind !== ind) { inf.errs.push('"if it fails" goes straight after the lines under a "try", at the same indent as the try.'); return say(`// ??? ${s}`); }
        b.kind = 'catch';
        if (m[1]) declare(m[1], 'const');
        note(inf, `\`catch\` runs only if a line under "try" fails: the program carries on instead of stopping.` + (m[1] ? ` ${code(m[1])} is the error; ${code(m[1] + '.message')} says what went wrong.` : ''));
        push('  '.repeat(stack.length - 1) + `} catch${m[1] ? ` (${m[1]})` : ''} {`, i);
        return;
      }
      if (FINALLY.test(s)) {
        const b = stack[stack.length - 1];
        if (!b || !/^(?:try|catch)$/.test(b.kind) || b.ind !== ind) { inf.errs.push('"in any case" goes after a "try" (and its "if it fails"), at the same indent.'); return say(`// ??? ${s}`); }
        b.kind = 'finally';
        note(inf, '`finally` always runs after the try, whether something failed or not: a place to tidy up.');
        push('  '.repeat(stack.length - 1) + '} finally {', i);
        return;
      }
      if ((m = M(/^fail with\s+(.+)$/i))) {
        note(inf, '`throw` stops with an error. Whoever ran this can catch it with "try" and "if it fails".');
        return say(`throw new Error(${E(m[1], inf)});`);
      }
      // --- "depending on x", with "when it is 1" (or "1 or 2") and "otherwise" under it: the same words as C++
      const top = stack[stack.length - 1];
      if ((m = M(/^depending on\s+(.+)$/i))) {
        note(inf, '`switch` runs the case whose value matches (`===`). Each case ends with `break;`, so only its own steps run.');
        return open(`switch (${E(m[1], inf)}) {`, '}', 'switch');
      }
      const inSwitch = top && top.kind === 'switch';
      if ((m = M(/^when it(?:'s|\s+is)\s+(.+)$/i)) || (inSwitch && /^(?:otherwise|else)$/i.test(s))) {
        if (!inSwitch) { inf.errs.push('"when it is …" goes right under "depending on …", one step further in.'); return say(`// ??? ${s}`); }
        if (!m && top.hasDefault) inf.errs.push('There is already an "otherwise" here. A "depending on" has only one.');
        if (!m) top.hasDefault = true;
        for (const h of m ? outsideQuotes(m[1], (t) => t.replace(/\s+or\s+/gi, '\u0002')).split('\u0002').map(v => `case ${E(v, inf)}:`) : ['default:']) say(h);
        const b = { ind, kind: 'case', src: i, head: out[out.length - 1] };
        b.close = caseEnd(b);
        stack.push(b); scopes.push(new Map());
        return;
      }
      if (/^(?:go on|carry on) into the next case$/i.test(s)) {
        if (!top || top.kind !== 'case') { inf.errs.push('"go on into the next case" goes last in a case ("when it is …").'); return; }
        top.fall = true;
        note(inf, 'No `break;` at the end of this case, so JavaScript carries on with the steps of the next case.');
        return;
      }
      if (inSwitch) { inf.errs.push('Under "depending on …", each step goes in a case: "when it is …" or "otherwise".'); return say(`// ??? ${s}`); }
      if ((m = M(/^do this,? then repeat (?:while|as long as)\s+(.+)$/i))) {
        note(inf, '`do … while` runs the steps once, then again for as long as the test is true.');
        return open('do {', `} while (${E(m[1], inf, true)});`, 'loop');
      }
      // --- classes: "define class Store", with "when a new Store is made with key" and "define load" inside
      if ((m = M(/^define (?:a )?class\s+([A-Za-z_$][\w$]*)(?:\s+based on\s+([A-Za-z_$][\w$.]*))?$/i))) {
        note(inf, `A class is a blueprint for objects: each one made from it ("a new ${m[1]}") keeps its own values, \`this.…\`, and can use the tools defined inside it.` + (m[2] ? ` It builds on ${code(m[2])} (\`extends\`).` : ''));        declare(m[1]);
        return open(`class ${m[1]}${m[2] ? ' extends ' + m[2] : ''} {`, '}', 'class', { cls: m[1] });
      }
      const inClass = top && top.kind === 'class';
      if ((m = M(/^when (?:a )?new\s+([A-Za-z_$][\w$]*)\s+is (?:made|created)(?:\s+(?:with|using)\s+(.+))?$/i))) {
        if (!inClass) inf.errs.push(`"when a new ${m[1]} is made" sets up each new object of a class, so it goes right inside "define class ${m[1]}".`);
        else if (m[1] !== top.cls) inf.errs.push(`This is inside the class ${code(top.cls)}, so it's "when a new ${top.cls} is made".`);
        const ps = m[2] ? splitItems(m[2]) : [];
        note(inf, '`constructor` runs each time a new object is made, and sets up its values (`this.…`).');
        open(`constructor(${ps.join(', ')}) {`, '}', 'fn', { def: true });
        for (const p of ps) declare(p.replace(/\s*=.*$/, ''));
        return;
      }
      if (inClass && !/^define\s/i.test(s)) { inf.errs.push('Inside "define class", each part is "when a new … is made" or "define …" (a tool of its own).'); return say(`// ??? ${s}`); }
      // --- other files' tools: "bring in fetchSales from "./api.js""
      if ((m = M(/^bring in\s+(.+?)\s+from\s+("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')$/i))) {
        const names = splitAnd(m[1]).map(n => n.trim());
        if (names.some(n => !/^[A-Za-z_$][\w$]*$/.test(n))) inf.errs.push('Name each thing to bring in, like: bring in fetchSales and saveSales from "./api.js".');
        if (stack.length) inf.errs.push('"bring in" goes at the left edge, near the top.');
        note(inf, '`import` brings in tools another JavaScript file shares (with `export`). The page has to load this file as a module.');
        names.forEach(n => declare(n, 'const'));
        return say(`import { ${names.join(', ')} } from ${m[2]};`);
      }
      // --- logic (same sentences as Python, JavaScript output)
      if ((m = M(/^(?:otherwise if|else if)\s+(.+)$/i))) { push('  '.repeat(stack.length - 1) + `} else if (${E(m[1], inf, true)}) {`, i); return; }
      if (/^(?:otherwise|else)$/i.test(s)) { push('  '.repeat(stack.length - 1) + '} else {', i); return; }
      if ((m = M(/^if\s+(.+)$/i))) {
        // "if n is 1 then show 1": Mechanics takes one step per line
        if (/\s+then\s+\S/i.test(outsideQuotes(m[1], t => t))) inf.errs.push('In Mechanics, the step goes on its own line, indented under the "if" (not after "then").');
        return open(`if (${E(m[1], inf, true)}) {`, '}', 'if');
      }
      if ((m = M(/^repeat\s+(.+?)\s+times?(?:\s+counting with\s+(\w+))?$/i))) { const v = m[2] || 'i'; x.vars.add(v); open(`for (let ${v} = 0; ${v} < ${E(m[1], inf)}; ${v}++) {`, '}', 'loop'); declare(v); return; }
      if ((m = M(/^for each\s+([A-Za-z_$][\w$]*)\s+in\s+(.+)$/i))) {
        const kind = changedLater(i, m[1], true) ? 'let' : 'const';
        note(inf, '`for … of` goes through the items one at a time.' + (kind === 'let' ? ` It uses \`let\` because the lines inside change ${code(m[1])}.` : ''));
        open(`for (${kind} ${m[1]} of ${E(m[2], inf)}) {`, '}', 'loop');
        declare(m[1], kind);
        return;
      }
      if ((m = M(/^(?:while|as long as)\s+(.+)$/i))) return open(`while (${E(m[1], inf, true)}) {`, '}', 'loop');
      // "do this for each todo in todos[, counting with i]": .forEach, a little tool run for each item
      if ((m = M(/^do this for each\s+([A-Za-z_$][\w$]*)\s+in\s+(.+?)(?:,?\s+counting with\s+([A-Za-z_$][\w$]*))?$/i))) {
        note(inf, '`.forEach` runs the indented lines once for each item' + (m[3] ? `, with ${code(m[3])} counting from 0.` : '.') + ' It is a little tool of its own: "give back" ends this round, and "stop the loop" doesn\'t work here.');
        open(`${E(m[2], inf)}.forEach(${needsAsync(i) ? 'async ' : ''}(${m[1]}${m[3] ? ', ' + m[3] : ''}) => {`, '});', 'fn');
        declare(m[1]); if (m[3]) declare(m[3]);
        return;
      }
      if ((m = M(/^sort\s+(.+?)\s+(from (?:smallest|lowest) to (?:biggest|largest|highest)|from (?:biggest|largest|highest) to (?:smallest|lowest)|as text)$/i))) {
        note(inf, /as text/i.test(m[2]) ? '`.sort()` puts the items in order as text (so 10 comes before 9), in the list itself.' : '`.sort` with `a - b` puts numbers in order, in the list itself.');
        return say(`${E(m[1], inf)}.sort(${/as text/i.test(m[2]) ? '' : /^from (?:smallest|lowest)/i.test(m[2]) ? '(a, b) => a - b' : '(a, b) => b - a'});`);
      }
      if ((m = M(/^reverse\s+(.+)$/i))) { note(inf, '`.reverse()` turns the list round, in the list itself.'); return say(`${E(m[1], inf)}.reverse();`); }
      // "constant double is a tool using n giving back n times 2", or with its steps indented under it: an arrow function
      if ((m = M(/^(constant|set)\s+([A-Za-z_$][\w$]*)\s+(?:is|to)\s+a tool(?:\s+using\s+(.+?))?(?:\s+giving back\s+(.+))?$/i)) && !inClass) {
        const constant = /^constant$/i.test(m[1]), ps = m[3] ? splitItems(m[3]) : [];
        const kw = constant ? (scopes[scopes.length - 1].has(m[2]) ? (inf.errs.push(`${code(m[2])} already exists here, so it can't be made again.`), '') : (declare(m[2], 'const'), 'const ')) : keyword(m[2], inf);
        note(inf, '`=>` makes a little tool (an arrow function), kept under this name; "run ' + m[2] + '" runs it.');
        if (m[4] != null) {
          const added = ps.map(p => p.replace(/\s*=.*$/, '')).filter(p => !x.vars.has(p));
          added.forEach(p => x.vars.add(p));
          let v; try { v = E(m[4], inf); } finally { added.forEach(p => x.vars.delete(p)); }
          return say(`${kw}${m[2]} = ${/\bawait\b/.test(v) ? 'async ' : ''}(${ps.join(', ')}) => ${/^\{/.test(v) ? `(${v})` : v};`);
        }
        open(`${kw}${m[2]} = ${needsAsync(i) ? 'async ' : ''}(${ps.join(', ')}) => {`, '};', 'fn', { def: true });
        for (const p of ps) declare(p.replace(/\s*=.*$/, ''));
        return;
      }
      if ((m = M(/^define\s+([A-Za-z_$][\w$]*)(?:\s+using\s+(.+))?$/i))) {
        const ps = m[2] ? splitItems(m[2]) : [], bad = nameProblem(m[1], !stack.length && !inClass);
        if (bad && !inClass) inf.errs.push(bad);
        note(inf, inClass ? `A tool of every ${top.cls} object (a method): inside it, \`this\` is the object it was used on.` : '`function` makes a reusable tool.');
        open(`${needsAsync(i) ? 'async ' : ''}${inClass ? '' : 'function '}${m[1]}(${ps.join(', ')}) {`, '}', 'fn', { def: true });
        for (const p of ps) declare(p.replace(/\s*=.*$/, ''));   // its inputs are names inside it already
        return;
      }
      if ((m = M(/^(?:give back|return)\b\s*(.*)$/i))) {
        // "give back total and count": two values, or a yes/no test that both are true?
        const parts = m[1] ? splitAnd(m[1]) : [];
        // (one whole value, like "the result of f with a and b" or "a if b and c otherwise d", is one value)
        const oneValue = /^(?:the\s+)?(?:result|answer) of\s|^an? new\s|^a list of\s|^the first\s/i.test(m[1].trim()) || (topFind(m[1], /\s+if\s+/i) && topFind(m[1], /\s+otherwise\s+/i)) || topFind(m[1], /\s+for (?:every|any)\s+/i);
        if (parts.length > 1 && !/,/.test(outsideQuotes(m[1], t => t)) && !oneValue) inf.errs.push(`"give back ${m[1].trim()}" could mean two values, or a yes/no test that both are true. For two values, give back a list: give back [${parts.join(', ')}].`);
        return say(m[1] ? `return ${E(m[1], inf)};` : 'return;');
      }
      if (/^stop the loop$/i.test(s)) {
        const near = [...stack].reverse().find(b => /^(?:loop|case|fn)$/.test(b.kind));
        if (near && near.kind === 'case') inf.errs.push('Inside "depending on", `break` only ends the case, not the loop around it. To stop the loop from here, set a yes/no value and test it after "depending on".');
        return say('break;');
      }
      if (/^skip to next$/i.test(s)) return say('continue;');
      if ((m = M(/^(?:create|make)\s+(?:an?\s+)?(?:new\s+)?(?:empty\s+)?list\s+(?:called\s+)?([A-Za-z_$][\w$]*)(?:\s+with\s+(.+))?$/i))) {
        return say(`${keyword(m[1], inf)}${m[1]} = [${m[2] ? splitAnd(m[2]).map(v => E(v, inf)).join(', ') : ''}];`);
      }
      if ((m = M(/^add\s+(.+?)\s+to\s+([A-Za-z_$][\w$]*)$/i))) {
        const k = x.kinds.get(m[2]), vals = splitAnd(m[1]);
        // a number or some text grows with += (.push is only for a list)
        if (k === 'number' || k === 'text') {
          if (vals.length > 1) inf.errs.push(`${code(m[2])} is ${k === 'number' ? 'a number' : 'text'}, so add one thing at a time, or join them first: add ${vals.join(' plus ')} to ${m[2]}.`);
          note(inf, `${code(m[2])} is ${k === 'number' ? 'a number' : 'text'}, so "add" uses \`+=\` (short for ${code(`${m[2]} = ${m[2]} + …`)}). On a list it would be \`.push\`.`);
          return say(`${m[2]} += ${E(m[1], inf)};`);
        }
        if (k === 'mixed') inf.warns.push(`${code(m[2])} is set to different kinds of value (a number in one place, a list in another…), so it can't be told what "add" means here: this adds as for a list (\`.push\`). If it's a number here, write "increase ${m[2]} by …".`);
        note(inf, '`.push` adds to the end of a list.' + (vals.length > 1 ? ' With several values, it adds each one, in order.' : ''));
        return say(`${m[2]}.push(${vals.map(v => E(v, inf)).join(', ')});`);
      }
      if ((m = M(/^(increase|decrease)\s+(.+?)(?:\s+by\s+(.+))?$/i))) {
        const t = E(m[2], inf), up = /^increase$/i.test(m[1]);
        if (/^[A-Za-z_$][\w$]*$/.test(t) && isConst(t)) inf.errs.push(`${code(t)} is a constant (made with const), so it can't be changed.`);
        if (m[3]) return say(`${t} ${up ? '+' : '-'}= ${E(m[3], inf)};`);
        note(inf, `No amount given, so it goes ${up ? 'up' : 'down'} by 1: \`${up ? '++' : '--'}\` ${up ? 'adds' : 'takes away'} 1.`);
        return say(`${t}${up ? '++' : '--'};`);
      }
      if ((m = M(/^(multiply|divide)\s+(.+?)\s+by\s+(.+)$/i))) {
        const t = E(m[2], inf), by = E(m[3], inf), times = /^multiply$/i.test(m[1]);
        if (/^[A-Za-z_$][\w$]*$/.test(t) && isConst(t)) inf.errs.push(`${code(t)} is a constant (made with const), so it can't be changed.`);
        note(inf, `\`${times ? '*=' : '/='}\` is short for ${code(`${t} = ${t} ${times ? '*' : '/'} ${by}`)}.`);
        return say(`${t} ${times ? '*=' : '/='} ${by};`);
      }
      if ((m = M(/^ask\s+(.+?)\s+and store (?:it )?in\s+([A-Za-z_$][\w$]*)$/i))) { note(inf, '`prompt` shows a pop-up question. It gives back text.'); return say(`${keyword(m[2], inf)}${m[2]} = prompt(${E(m[1], inf, false, true)});`); }
      if ((m = M(/^constant\s+(?:the\s+)?([A-Za-z_$][\w$]*)\s+(?:is|=)\s+(.+)$/i))) {
        note(inf, '`const` makes a name that always keeps this value; JavaScript stops with an error if anything tries to change it.');
        const value = E(m[2], inf);
        if (scopes[scopes.length - 1].has(m[1])) inf.errs.push(`${code(m[1])} already exists here, so it can't be made again.`);
        declare(m[1], 'const');
        return say(`const ${m[1]} = ${value};`);
      }
      // one item of a list or a record: "set item i of xs to …", "set item c of item r of grid to …"
      if ((m = M(/^(?:set|let|make)\s+((?:the\s+)?(?:(?:first|last)\s+item|item\s+.+?)\s+(?:of|in)\s+.+?)\s+(?:to|be)\s+(.+)$/i))) {
        const target = E(m[1], inf);
        if (!/[\]]$/.test(target)) inf.errs.push(`Only an item of a list or a record can be set like this, and ${code(target)} isn't one.`);
        note(inf, `${code(target)} is one item: square brackets pick it by its position (from 0) in a list, or its key in a record, and \`=\` stores the new value there.`);
        return say(`${target} = ${E(m[2], inf)};`);
      }
      // a value inside something: "set colour of square to brush", "set meter-fill.style.width to …"
      const PATH = nameSource(x) + String.raw`(?:\.[A-Za-z_$][\w$]*|\[[^\]]+\])+`;
      const atHead = (p) => p.replace(new RegExp('^' + nameSource(x)), (h) => (!x.vars.has(h) && !x.fns.has(h) && x.shared.ids[toId(h)] ? `document.getElementById("${toId(h)}")` : h));
      if ((m = M(new RegExp(String.raw`^(?:set|let|make)\s+(${PATH})\s+(?:to|be)\s+(.+)$`, 'i')))) {
        const target = atHead(m[1]);
        note(inf, `Changes ${code(target)}: a value that belongs to ${code(target.replace(/(?:\.[A-Za-z_$][\w$]*|\[[^\]]+\])$/, ''))}.`);
        return say(`${target} = ${E(m[2], inf)};`);
      }
      const ownerKnown = (t) => { t = t.trim().replace(/^the\s+/i, ''); const h = t.match(/^(?:(?:first|last)\s+item|item\s+.+?)\s+(?:of|in)\s+([A-Za-z_$][\w$]*)$|^([A-Za-z_$][\w$]*)(?:\.[A-Za-z_$][\w$]*|\[[^\]]+\])*$/i); return !!x.shared.ids[toId(t)] || !!(h && x.vars.has(h[1] || h[2])); };
      if ((m = M(/^(?:set|let|make)\s+(?:the\s+)?([A-Za-z_$][\w$]*|"[^"]*"|'[^']*')\s+of\s+(.+?)\s+(?:to|be)\s+(.+)$/i)) && !/^(?:text|value)$/i.test(m[1]) && ownerKnown(m[2])) {   // ("set number of lives to 3" isn't one: nothing is called lives)
        const owner = E(m[2], inf), key = strOf(m[1]);
        const target = key != null ? `${owner}[${JSON.stringify(key)}]` : `${owner}.${m[1]}`;
        note(inf, `${code(target)} is the ${code(key ?? m[1])} value inside ${code(owner)}; \`=\` stores the new value there.`);
        return say(`${target} = ${E(m[3], inf)};`);
      }
      if ((m = M(/^(?:set|let|make)\s+(?:the\s+)?([A-Za-z_$][\w$]*)\s+(?:to|be)\s+(.+)$/i))) {
        const value = E(m[2], inf), kw = keyword(m[1], inf);
        if (kw) note(inf, '`let` creates a name that can change later.');
        return say(`${kw}${m[1]} = ${value};`);
      }
      if ((m = M(new RegExp(String.raw`^run\s+(${nameSource(x)}(?:\.[A-Za-z_$][\w$]*|\[[^\]]+\])*)(?:\s+with\s+(.+?))?(\s+without waiting)?(?:\s+and store (?:it |the result )?in\s+([A-Za-z_$][\w$]*))?$`, 'i')))) {
        const later = !!m[3];
        m = [m[0], m[1], m[2], m[4]];
        const waits = !later && x.fns.has(m[1]) && fnIsAsync(m[1]) && insideFn();
        if (waits) note(inf, `${code(m[1])} waits for something, so \`await\` waits for it to finish before the next line.`);
        if (later) note(inf, `"without waiting" starts ${code(m[1])} and goes straight on to the next line, without \`await\`.`);
        // a tool nobody made: a typo, most likely (the browser's own and a js: line's are known)
        if (/^[A-Za-z_$][\w$]*$/.test(m[1]) && !x.fns.has(m[1]) && !x.vars.has(m[1]) && !BROWSER_NAMES.test(m[1]) && !/^(?:alert|confirm|prompt|setTimeout|setInterval|clearTimeout|clearInterval|fetch|requestAnimationFrame)$/.test(m[1])) {
          inf.warns.push(`There's no tool called ${code(m[1])} here. Make one with "define ${m[1]} using …", or check the spelling.`);
        }
        const call = `${waits ? 'await ' : ''}${atHead(m[1])}(${m[2] ? splitAnd(m[2]).map(v => E(v, inf)).join(', ') : ''})`;
        if (m[3]) return say(`${keyword(m[3], inf)}${m[3]} = ${call};`);
        return say(call + ';');
      }
      if ((m = M(/^show\s+(.+)$/i))) { note(inf, '`console.log` writes to the developer console (the terminal below). To show something on the page, use "set the text of …".'); return say(`console.log(${splitAnd(m[1]).map(v => E(v, inf)).join(', ')});`); }   // ("show a is 1 and b is 2" is one test)
      // a name that can't be one: "set number of lives to 3", "set 2nd place to 5", one that is an element's
      if ((m = M(/^(?:(?:set|let|make)\s+(?:the\s+)?(.+?)\s+(?:to|be)|constant\s+(?:the\s+)?(.+?)\s+(?:is|=))\s+\S/i))) {
        const n = (m[1] ?? m[2]).trim(), p = spacedProblem(n, x.shared) || (/^\d/.test(n) ? `A name can't start with a number, so "${n}" can't be one. Put a word before it, like "my ${n}".` : null);
        if (p) { inf.errs.push(p); return say('// ??? ' + s); }
      }
      inf.errs.push('I don\'t recognise this sentence. Open the Index (in Help) to see what Mechanics understands, or start the line with js: to write JavaScript directly.');
      say('// ??? ' + s);
    });
    patched();
    while (stack.length) { const b = stack.pop(); while (out.length && out[out.length - 1].text === '') out.pop(); for (const c of closeOf(b)) push('  '.repeat(stack.length) + c, b.src); }
    out.forEach((o, idx) => { if (o.src >= 0) info[o.src].py.push(idx); });
    // at most one blank line in a row, except between exact lines: those are the code's own (in a template literal
    // they're part of its text)
    const runs = [];
    for (const o of out) {
      if (o.kept) runs.push('');
      else if (Array.isArray(runs[runs.length - 1])) runs[runs.length - 1].push(o.text);
      else runs.push([o.text]);
    }
    return { lines: out, info, text: runs.map(r => (Array.isArray(r) ? r.join('\n').replace(/\n{3,}/g, '\n\n') : r)).join('\n') + '\n' };
  }

  /* ================================================================== */
  /* A website project                                                   */
  /* ================================================================== */

  function compileWebsite(project) {
    const shared = { ids: {}, groups: {}, cssGroups: {}, addGroups: {}, addIds: {}, wanted: {} };
    // where the page and the project's files are, for the links Structure adds (addsLink): project.files is every
    // file ({ path, lang }); without paths (a check, an older caller) the page is written as it always was
    const pathOf = (f) => (project.sections.find(s => s.file === f) || {}).path || null;
    if (pathOf('structure') && Array.isArray(project.files)) shared.site = { page: pathOf('structure'), styling: pathOf('styling'), mechanics: pathOf('mechanics'), files: project.files };
    const held = {};
    const sec = (f) => {
      if (!held[f]) { const s = project.sections.find(s => s.file === f) || { id: f, file: f, text: '' }; const h = holdBlanks(s.text); held[f] = { sec: { ...s, text: h.text }, blanks: h.blanks, strays: h.strays }; }
      return held[f].sec;
    };
    // Structure first (names), then Styling and Mechanics (they may add groups, or names for things they point
    // at by their text), then Structure again with those
    compileHtml(sec('structure'), shared);
    const css = compileCss(sec('styling'), shared);
    const js = compileJs(sec('mechanics'), shared);
    shared.ids = {};
    const html = compileHtml(sec('structure'), shared);
    // the same page with each element marked with its sentence line, for the preview's Pick
    const marked = compileHtml(sec('structure'), { ...shared, ids: {}, mark: true });
    html.previewText = marked.text;
    const results = { structure: html, styling: css, mechanics: js };
    for (const f of Object.keys(results)) reportBlanks(results[f].info, held[f].blanks, held[f].strays);
    const syms = new Map();
    for (const [id, v] of Object.entries(shared.ids)) syms.set(id, { py: id, display: id, kind: 'element', tag: v.tag });
    for (const g of Object.keys({ ...shared.groups, ...shared.cssGroups })) syms.set('group ' + g, { py: g, display: 'group ' + g, kind: 'group' });
    return { results: Object.fromEntries(project.sections.map(s => [s.id, results[s.file]])), syms, shared };
  }

  /* A file a page names (href="styles.css?v=2", "../css/site.css"), as a path in the project, from the page's
     path; null for an address elsewhere (https://…, //cdn…, data:…). */
  function pagePath(page, ref) {
    if (typeof ref !== 'string' || !ref || /^(?:[a-z][\w+.-]*:|\/\/)/i.test(ref)) return null;
    let p = ref.split(/[?#]/)[0];
    try { p = decodeURIComponent(p); } catch (_) { return null; }
    const parts = p.startsWith('/') ? [] : String(page || '').split('/').slice(0, -1);
    for (const seg of p.split('/')) {
      if (seg === '..') parts.pop();
      else if (seg && seg !== '.') parts.push(seg);
    }
    return parts.join('/') || null;
  }

  /* The page with its CSS and JS inlined, for the live preview. extra (optional): { page: its path, styles: { path:
     css } of the project's style sheets, styling: the main one's path }: every style sheet the page links that is
     the project's is inlined where it's linked (marked data-ic-file, for Project Link), the main one only once. */
  /* Returns { html, jsLine }: jsLine is the document line where script.js starts (to map errors back). */
  function previewDocument(compiled, helperScript, extra) {
    const r = compiled.results;
    const st = r.structure || { text: '' };
    let html = st.previewText || st.text;
    const css = (r.styling || { text: '' }).text, js = (r.mechanics || { text: '' }).text;
    const styleTag = (path, text) => `<style${path ? ` data-ic-file="${path.replace(/[&"<>]/g, c => ({ '&': '&amp;', '"': '&quot;', '<': '&lt;', '>': '&gt;' }[c]))}"` : ''}>\n${text.replace(/<\/style/gi, '<\\/style')}</style>`;
    const inlined = new Set();
    if (extra && extra.styles) {
      html = html.replace(/<link\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi, (tag) => {
        if (!/\srel\s*=\s*["']?stylesheet\b/i.test(tag)) return tag;
        const m = tag.match(/\shref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
        const path = m && pagePath(extra.page, m[1] ?? m[2] ?? m[3]);
        if (!path || !Object.prototype.hasOwnProperty.call(extra.styles, path) || inlined.has(path)) return tag;
        inlined.add(path);
        return styleTag(path, extra.styles[path]);
      });
    }
    // functions, not replacement strings: $&, $' and $$ in the code must stay as they are
    const main = extra && extra.styling;
    const withCss = html.replace(/<link\b[^>]*\bhref\s*=\s*["']?style\.css["']?[^>]*>/i, () => (main && inlined.has(main) ? '' : styleTag(main || '', css)));
    const helper = helperScript ? `<script>${helperScript}</script>\n` : '';
    const inline = `${helper}<script>\n${js.replace(/<\/script/gi, '<\\/script')}</script>`;
    const tag = withCss.match(/<script\b[^>]*\bsrc\s*=\s*["']?script\.js["']?[^>]*><\/script>/i);
    let doc = withCss;
    if (tag && /\b(?:defer|async)\b/i.test(tag[0].replace(/"[^"]*"|'[^']*'/g, ''))) {   // a deferred script runs once the page is read: at the end of <body>
      doc = withCss.slice(0, tag.index) + withCss.slice(tag.index + tag[0].length);
      const end = doc.search(/<\/body>/i);
      doc = end < 0 ? doc + inline : doc.slice(0, end) + inline + '\n' + doc.slice(end);
    } else if (tag) doc = withCss.slice(0, tag.index) + inline + withCss.slice(tag.index + tag[0].length);
    const start = doc.indexOf(inline);
    return { html: doc, jsLine: doc.slice(0, start + helper.length).split('\n').length + 1 };
  }

  /* ------------------------------------------------------------------ */
  /* Phrase picker + Index content                                       */
  /* ------------------------------------------------------------------ */

  const T = (group, pattern, code2, tip, sections) => ({ group, pattern, py: code2, tip, sections });
  const TEMPLATES = [
    T('Page', 'page title is "‹title›"', '<title>…</title>', 'Shown in the browser tab.', ['structure']),
    T('Text', 'add a big heading "‹text›"', '<h1>…</h1>', 'One per page: the main title.', ['structure']),
    T('Text', 'add a heading "‹text›"', '<h2>…</h2>', '', ['structure']),
    T('Text', 'add a paragraph called ‹name› saying "‹text›"', '<p id="name">…</p>', 'The name is how Styling and Mechanics refer to it (to change its text, say).', ['structure']),
    T('Text', 'add a paragraph "‹text›"', '<p>…</p>', '', ['structure']),
    T('Controls', 'add a button called ‹name› saying "‹text›"', '<button id="name">…</button>', 'The name is how Styling and Mechanics refer to it.', ['structure']),
    T('Controls', 'add a text box called ‹name› with hint "‹hint›"', '<input id="name" placeholder="…">', 'Also: number box, password box, email box, big text box.', ['structure']),
    T('Controls', 'add a drop-down called ‹name› with "‹a›", "‹b›"', '<select><option>…', '', ['structure']),
    T('Controls', 'add a number box called ‹name› allowing decimals, from ‹0› to ‹100›', '<input type="number" step="any" min="0" max="100">', 'Also: in steps of 5, at least 1, at most 10, with a number keypad. A time box picks a time.', ['structure']),
    T('Controls', 'add a checkbox called ‹name› saying "‹text›"', '<input type="checkbox">', 'Mechanics: "if ‹name› is ticked", "tick ‹name›", "untick ‹name›".', ['structure']),
    T('Controls', 'add a slider called ‹name› from ‹0› to ‹100›', '<input type="range">', 'Its value is where it is set, as text.', ['structure']),
    T('Controls', 'add a file picker called ‹name› for ‹pictures›', '<input type="file" accept="image/*">', 'Or for sounds, videos, text files, or "‹.csv›". "for several pictures" lets people pick more than one. Mechanics: "the file in ‹name›".', ['structure']),
    T('Media', 'add a picture of "‹file.jpg›" described as "‹what it shows›"', '<img src="…" alt="…">', 'The description is read aloud by screen readers.', ['structure']),
    T('Media', 'add a drawing area called ‹game› ‹480› by ‹270›', '<canvas id="game" width="480" height="270">', 'Where a game or a picture is drawn, from Mechanics.', ['structure']),
    T('Media', 'add a link to "‹https://…›" saying "‹text›"', '<a href="…">…</a>', 'An address as people write it works too: google.com is https://google.com, me@example.com is mailto:…, a phone number is tel:….', ['structure']),
    T('Layout', 'add a section called ‹name›', '<section id="name">', 'Indent the things that belong inside it. Also: header, footer, navigation bar, main area, block, card, form, side panel.', ['structure']),
    T('Layout', 'add a list called ‹name›', '<ul id="name">', 'Indent "add a list item "…"" under it.', ['structure']),
    T('Layout', '… in group ‹name›', 'class="name"', 'Add to the end of any line to put it in a group (a CSS class).', ['structure']),
    T('Layout', 'add a box called ‹name›', '<div id="name">', 'A box (a block) holds the lines indented under it. With a box setting ("with hint …") it is a box to type in.', ['structure']),
    T('Layout', 'add a figure', '<figure>', 'Indent a picture and add a caption "‹text›" under it.', ['structure']),
    T('Layout', 'add a collapsible section', '<details>', 'Indent add a summary "‹title›" (always shown), then what opens under it.', ['structure']),
    T('Layout', 'add a ‹my-widget› element', '<my-widget>', 'Any element that has no words of its own.', ['structure']),
    T('Text', '"‹text›"', 'text', 'Text on its own line, inside the element above it: text with other things in it ("add bold text …") is said a line at a time.', ['structure']),
    T('Text', 'add bold text "‹text›"', '<b>…</b>', 'Also strong text, italic text, emphasised text, highlighted text, small text, code "…", a key "Ctrl", a line break.', ['structure']),
    T('Media', 'add a chart called ‹name› ‹600› by ‹300›', '<canvas id="name" width="600" height="300">', 'A chart is drawn on a drawing area, by Mechanics or a chart library.', ['structure']),
    T('Settings', '…, hidden from screen readers', 'aria-hidden="true"', 'Settings go after commas at the end of a line, before "in group". Also: labelled "‹text›" for screen readers, labelled by ‹name›, controls ‹name›, starts collapsed, marked as the current page, read out when it changes.', ['structure']),
    T('Settings', '…, with tooltip "‹text›"', 'title="…"', 'Shown when the pointer rests on it.', ['structure']),
    T('Settings', '…, storing ‹chord› "‹C›"', 'data-chord="C"', 'A value kept on the element for Mechanics (and for CSS: attr(data-chord)).', ['structure']),
    T('Settings', '…, disabled', 'disabled', 'Also hidden, required, read-only, ticked, selected, opening in a new tab, sent as "‹name›", sized ‹320› by ‹180›, with no description.', ['structure']),
    T('Settings', '…, running "‹clearDone()›" when clicked', 'onclick="…"', 'Code run from the tag itself. Mechanics ("when … is clicked") keeps it out of the page.', ['structure']),
    T('Settings', '…, with ‹name› "‹value›"', 'name="value"', 'Any other attribute, as it is written.', ['structure']),
    T('Settings', '…, with no space before it', '(no space)', 'Joins it to the thing before: a line break between two pieces of text, links or pictures would show as a space.', ['structure']),
    T('Drawings', 'add a drawing sized ‹200› by ‹100›, drawn on a ‹200› by ‹100› grid', '<svg width height viewBox>', 'A picture made of shapes (SVG). Indent the shapes under it; the grid is what their positions count in.', ['structure']),
    T('Drawings', 'add a circle at ‹50›, ‹50› with radius ‹40›, filled with ‹gold›', '<circle cx cy r fill>', 'Also: an ellipse … with radii 20 and 10. Inside a drawing only.', ['structure']),
    T('Drawings', 'add a rectangle at ‹10›, ‹10› sized ‹80› by ‹40›, with rounded corners ‹6›', '<rect x y width height rx>', '', ['structure']),
    T('Drawings', 'add a line from ‹0›, ‹0› to ‹100›, ‹50›, outlined in ‹navy›, outline ‹2› wide', '<line x1 y1 x2 y2 stroke stroke-width>', '', ['structure']),
    T('Drawings', 'add a path following "‹M 0 0 L 100 50›", not filled, outlined in ‹navy›', '<path d fill="none" stroke>', 'The path data stays as written. Also: a polygon through "‹0,0 10,0 5,8›".', ['structure']),
    T('Drawings', 'add text "‹label›" at ‹10›, ‹20›', '<text x y>', 'Text drawn in the drawing.', ['structure']),
    T('Drawings', 'add a gradient called ‹sky› from ‹#87ceeb› to ‹#ffffff›', '<linearGradient><stop>…', 'Add "through ‹colour› at ‹.5›" for more colours, ", ending ‹0› across and ‹1› down" for its direction; then "filled with the gradient sky". Put it in "add reusable parts".', ['structure']),
    T('Drawings', 'add a set of shapes, outlined in ‹navy›', '<g stroke>', 'Settings on it apply to the shapes indented under it.', ['structure']),
    T('Styles', 'set ‹name› colour to ‹colour›', '#name { color: … }', 'Also background, border, text size, width, rounded corners, shadow. The thing can be a name, the text it shows in quotes ("Welcome"), or a kind: the big heading, every button.', ['styling']),
    T('Styles', 'give ‹name› a ‹red› border', '#name { border: 1px solid red }', 'Also "give … rounded corners", "give … a shadow".', ['styling']),
    T('Styles', 'make ‹name› ‹bold›', '#name { font-weight: bold }', 'Or a colour: "make save navy". Also italic, underlined, hidden, centred.', ['styling']),
    T('Styles', 'style ‹name›: background ‹colour›, text colour ‹colour›', '#name { background: …; color: … }', 'Separate styles with commas.', ['styling']),
    T('Styles', 'add group ‹name›: ‹styles›', '.name { … }', 'The same as "create group". A group is a CSS class: put things in it with "add ‹thing› to group ‹name›".', ['styling']),
    T('Styles', 'add ‹name› to group ‹group›', 'class="group" in the HTML', 'Puts an element from Structure in a group. It can be its name or its text in quotes.', ['styling']),
    T('Styles', 'add a colour called ‹main› ‹#4f7cff›', ':root { --main: … }', 'A shared colour. Use it as "the colour main". Its name runs up to the colour: "main blue #4f7cff" is the colour main blue.', ['styling']),
    T('Styles', 'create group ‹name›: rounded corners ‹8›, shadow', '.name { border-radius: 8px; box-shadow: … }', 'A group is a CSS class. Reuse it on many elements.', ['styling']),
    T('Styles', 'style ‹name›: border ‹2› ‹dashed› ‹navy›', '#name { border: 2px dashed navy }', 'The line can be solid, dashed, dotted or double; without a width it is 1px. Also "outline …", "bottom border …" (top, left, right) and "no border".', ['styling']),
    T('Styles', 'add a border to ‹name›', '#name { border: 1px solid currentColor }', 'The same as "style ‹name›: border". Also "add a 2 dashed navy border to …", "add a shadow to …", "add rounded corners to …".', ['styling']),
    T('Styles', '‹element› belongs to group ‹group›', 'class="group" in the HTML', 'Adds the group to an element in Structure.', ['styling']),
    T('Styles', 'when ‹name› is hovered: ‹styles›', '#name:hover { … }', '', ['styling']),
    T('Styles', 'on screens narrower than ‹600›:', '@media (max-width: 600px) {', 'Indent styles under it for phones.', ['styling']),
    T('Styles', 'shared colour ‹main› is ‹#4f7cff›', ':root { --main: … }', 'Then use "background the colour main".', ['styling']),
    T('Styles', 'before ‹name›: content: "‹text›", ‹styles›', '#name::before { content: … }', 'A piece added at the start of the element, by CSS alone. "after ‹name›:" adds one at the end. content: attr(data-‹x›) shows a value Mechanics stored on the element.', ['styling']),
    T('Events', 'when ‹name› is clicked', 'name.addEventListener("click", …)', 'Indent what should happen.', ['mechanics']),
    T('Events', 'when ‹form› is sent', 'form.addEventListener("submit", …)', 'The page won\'t reload.', ['mechanics']),
    T('Events', 'when the page has loaded', 'DOMContentLoaded', '', ['mechanics']),
    T('Events', 'when ‹name› is clicked, with the event as ‹e›', 'name.addEventListener("click", (e) => …)', 'Names what happened, for the indented lines: e.target is the element it happened to.', ['mechanics']),
    T('Page', 'constant ‹box› is the element matching "‹#list li›"', 'document.querySelector(…)', 'The first element the CSS selector picks; "every element matching …" gives them all.', ['mechanics']),
    T('Logic', 'run ‹tool› without waiting', 'tool();', 'Starts a tool that waits for something (a fetch) and goes straight on to the next line, without await.', ['mechanics']),
    T('Events', 'every ‹2› seconds', 'setInterval(…, 2000)', 'The time can be a name too: "every gap seconds".', ['mechanics']),
    T('Events', 'every ‹1› second as ‹ticker›', 'ticker = setInterval(…)', 'Named, so "stop ‹ticker›" can stop it (clearInterval). Also "after 3 seconds as ‹reminder›".', ['mechanics']),
    T('Errors', 'try', 'try { … }', 'Indent the lines that might fail; then "if it fails" at the same indent, with what to do instead.', ['mechanics']),
    T('Errors', 'if it fails', '} catch { … }', '"if it fails as problem" keeps the error: problem.message says what went wrong. "in any case" runs either way.', ['mechanics']),
    T('Errors', 'wait for ‹navigator.clipboard.writeText(text)›', 'await …', 'Waits for something that finishes later. Add "and store in ‹name›" to keep what it gives back.', ['mechanics']),
    T('Games', 'every frame', 'requestAnimationFrame(…)', 'About 60 times a second: move things, then draw them.', ['mechanics']),
    T('Games', 'keep track of the keys', 'keysDown: a Set', 'Once, near the top of Mechanics. Then "if "left" is held".', ['mechanics']),
    T('Games', 'if "‹left›" is held', 'if (keysDown.has("ArrowLeft"))', 'left, right, up, down, space, or a letter.', ['mechanics']),
    T('Games', 'when the key "‹space›" is pressed', 'keydown, for one key', 'Once per press. For holding a key down, use "is held" inside "every frame".', ['mechanics']),
    T('Games', 'when the screen is tapped', 'pointerdown', 'A finger or a mouse. "tap x" and "tap y" say where.', ['mechanics']),
    T('Games', 'when ‹game› is released', 'pointerup', 'A finger lifting or a mouse button let go over it. Also "when the screen is released", anywhere.', ['mechanics']),
    T('Games', 'when the pointer moves over ‹game›', 'pointermove', 'Again and again as it moves; "tap x" and "tap y" say where it is now.', ['mechanics']),
    T('Drawing', 'clear ‹game›', 'clearRect(…)', 'Wipes a drawing area, ready for the next frame.', ['mechanics']),
    T('Drawing', 'fill ‹game› with "‹skyblue›"', 'fillRect(0, 0, …)', '', ['mechanics']),
    T('Drawing', 'draw a rectangle at ‹x›, ‹y› sized ‹40› by ‹20› in "‹tomato›" on ‹game›', 'fillRect(x, y, 40, 20)', 'x across from the left, y down from the top.', ['mechanics']),
    T('Drawing', 'draw a circle at ‹x›, ‹y› with radius ‹10› in "‹gold›" on ‹game›', 'arc(…) + fill()', '', ['mechanics']),
    T('Drawing', 'draw text "‹Score: {score}›" at ‹10›, ‹24› in "‹white›" on ‹game›', 'fillText(…)', 'Add "size 24" before "in" for bigger text.', ['mechanics']),
    T('Drawing', 'draw a line from ‹x1›, ‹y1› to ‹x2›, ‹y2› in "‹white›" on ‹game›', 'lineTo(…) + stroke()', '', ['mechanics']),
    T('Drawing', 'load the picture "‹images/ship.png›" as ‹ship›', 'new Image()', 'Once, near the top. Add the file first: File → Add an image.', ['mechanics']),
    T('Drawing', 'draw ‹ship› at ‹x›, ‹y› on ‹game›', 'drawImage(…)', 'A loaded picture. Add "sized 64 by 64" before "on" to scale it.', ['mechanics']),
    T('Sound', 'play a note of ‹440› for ‹0.2› seconds', 'an oscillator (Web Audio)', '440 hertz is the note A; 880 is the A above.', ['mechanics']),
    T('Page', 'get the text of ‹name› and store in ‹value›', 'let value = name.value', 'Reads what was typed in a box.', ['mechanics']),
    T('Page', 'set the text of ‹name› to ‹value›', 'name.textContent = value', '', ['mechanics']),
    T('Page', 'add ‹value› to the list ‹name›', 'createElement("li") …', 'Adds a new item to a list on the page.', ['mechanics']),
    T('Page', 'hide ‹name›', 'name.hidden = true', 'And "reveal ‹name›".', ['mechanics']),
    T('Page', 'put ‹name› in group ‹group›', 'classList.add("group")', 'Also "take … out of group", "switch group … on …", and "if ‹name› is in group ‹group›".', ['mechanics']),
    T('Page', 'make a new ‹button› saying "‹text›" in ‹name› and store in ‹b›', 'document.createElement(…)', 'Also a list item, block, paragraph, text, link to ‹address›, picture of ‹file›. Add "in group ‹g›"; then "when ‹b› is clicked", "hide ‹b›" and the like work on it.', ['mechanics']),
    T('Server', 'fetch from "‹/api/items›" and store in ‹items›', 'await fetch(…).json()', '', ['mechanics']),
    T('Server', 'send ‹value› to "‹/api/items›"', 'fetch(…, { method: "POST" … })', '', ['mechanics']),
    T('Server', 'save ‹value› in the browser as "‹key›"', 'localStorage.setItem', 'And "load "key" from the browser and store in …".', ['mechanics']),
    T('Logic', 'set ‹name› to ‹value›', 'let name = value', 'Same sentences as Python: if, otherwise, repeat, for each, define, give back, run… A name of several words ("total price") is one name, totalPrice.', ['mechanics']),
    T('Logic', 'if ‹condition›', 'if (condition) {', '', ['mechanics']),
    T('Logic', 'for each ‹item› in ‹list›', 'for (const item of list) {', '', ['mechanics']),
    T('Logic', 'set item ‹i› of ‹list› to ‹value›', 'list[i] = value', 'Also for records: "set item "‹key›" of ‹record› to …", or "set ‹field› of ‹record› to …" (record.field).', ['mechanics']),
    T('Logic', 'define ‹name› using ‹inputs›', 'function name(inputs) {', 'Its first lines can be "description: …", what the tool is for.', ['mechanics']),
    T('Logic', 'multiply ‹name› by ‹amount›', 'name *= amount;', 'Also "divide ‹name› by ‹amount›" (/=).', ['mechanics']),
    T('Logic', 'set ‹name› to the result of ‹tool› with ‹inputs›', 'name = tool(inputs)', 'Keeps what the tool gives back. Inside a bigger value, put it in brackets: (the result of ‹tool›) plus 1.', ['mechanics']),
    T('Logic', 'set ‹name› to a new ‹Date›', 'name = new Date()', 'An object made from a class. Add "with ‹inputs›" for what it starts with.', ['mechanics']),
    T('Logic', 'set ‹name› to ‹a› if ‹test› otherwise ‹b›', 'name = test ? a : b', 'One value or the other, picked by the test.', ['mechanics']),
    T('Logic', 'depending on ‹value›', 'switch (value) {', 'Under it, one step in: "when it is 1", "when it is 2 or 3", "otherwise".', ['mechanics']),
    T('Logic', 'when it is ‹1›', 'case 1:', 'Inside "depending on". Each case ends by itself (break); "go on into the next case" carries on instead.', ['mechanics']),
    T('Logic', 'do this, then repeat while ‹test›', 'do { … } while (test);', 'The steps run once before the test.', ['mechanics']),
    T('Logic', 'define class ‹Store›', 'class Store {', 'A blueprint for objects. Inside: "when a new Store is made with ‹inputs›" and "define ‹tool›". Add "based on ‹Other›" to build on another class.', ['mechanics']),
    T('Logic', 'when a new ‹Store› is made with ‹key›', 'constructor(key) {', 'Inside "define class": sets up each new object. Its own values are this.something.', ['mechanics']),
    T('Logic', 'bring in ‹fetchSales› from "‹./api.js›"', 'import { fetchSales } from "./api.js";', 'Tools another JavaScript file shares. The page loads this file as a module.', ['mechanics']),
    T('Lists', 'set ‹doubled› to a list of ‹x times 2› for each ‹x› in ‹list›', 'list.map(x => x * 2)', 'A new list, one value for each item. Add "if ‹test›" at the end to keep only some (.filter).', ['mechanics']),
    T('Lists', 'set ‹found› to the first ‹x› in ‹list› where ‹test›', 'list.find(x => test)', 'The first item the test is true for.', ['mechanics']),
    T('Lists', 'set ‹ok› to ‹test› for every ‹x› in ‹list›', 'list.every(x => test)', 'Yes when the test is true for every item. "for any": true for at least one (.some).', ['mechanics']),
    T('Lists', 'set ‹line› to ‹list› joined by "‹, ›"', 'list.join(", ")', 'The items as one text, with the separator between them.', ['mechanics']),
    T('Text', 'set ‹shown› to ‹price› to ‹2› decimal places', 'price.toFixed(2)', 'Also "‹n› rounded", "rounded down", "rounded up", "‹text› trimmed", "‹text› split at ",".', ['mechanics']),
    T('Text', 'set ‹data› to ‹text› read as JSON', 'JSON.parse(text)', 'And "‹data› as JSON text" (JSON.stringify).', ['mechanics']),
    T('Page', 'constant ‹total› is the element called "‹total›"', 'document.getElementById("total")', 'An element by its id, for one Structure doesn\'t name.', ['mechanics']),
    T('Page', 'constant ‹item› is a new "‹li›" element', 'document.createElement("li")', 'A new element of any tag; "put ‹item› at the end of ‹list›" puts it on the page.', ['mechanics']),
    T('Page', 'put ‹item› at the end of ‹list›', 'list.appendChild(item)', 'Puts an element inside another, after what is already there.', ['mechanics']),
    T('Page', 'set the HTML of ‹name› to ‹value›', 'name.innerHTML = value', 'Replaces what is inside with this HTML. Only HTML you wrote: text people type could run as code.', ['mechanics']),
    T('Page', 'set the groups of ‹name› to "‹card done›"', 'name.className = "card done"', 'All of its groups at once. To add or take out one, "put ‹name› in group ‹g›".', ['mechanics']),
    T('Page', 'set the page title to ‹value›', 'document.title = value', 'The title on the browser tab.', ['mechanics']),
    T('Server', 'constant ‹reply› is the reply from "‹/api/items›"', 'await fetch("/api/items")', 'Then "the JSON read from ‹reply›" is what it sent (await reply.json()).', ['mechanics']),
    T('Server', 'wait for ‹navigator.clipboard.writeText› with ‹text›', 'await navigator.clipboard.writeText(text)', 'Runs a tool that finishes later and waits for it.', ['mechanics']),
    T('Server', 'constant ‹saved› is the text saved in the browser as "‹key›"', 'localStorage.getItem("key")', 'The text as it was saved (null if there is none).', ['mechanics']),
    T('Lists', 'do this for each ‹item› in ‹list›', 'list.forEach((item) => {', 'Add ", counting with ‹i›" for its place (from 0). It is a little tool of its own: "give back" ends this round.', ['mechanics']),
    T('Lists', 'sort ‹list› from smallest to biggest', 'list.sort((a, b) => a - b);', 'Also "from biggest to smallest", and "as text" (10 before 9). "reverse ‹list›" turns it round.', ['mechanics']),
    T('Logic', 'constant ‹double› is a tool using ‹n› giving back ‹n times 2›', 'const double = (n) => n * 2;', 'A little tool kept in a name (an arrow function). Leave out "giving back …" and indent its steps under it instead.', ['mechanics']),
    T('Errors', 'fail with "‹Not found›"', 'throw new Error("Not found");', 'Stops with an error; "if it fails" round the steps that ran it catches it.', ['mechanics']),
    T('Events', 'when a key is pressed in ‹name›, with the event as ‹e›', 'name.addEventListener("keydown", (e) => …)', 'e.key is the key: "Enter", "a", "ArrowLeft". Also "when a key is released in …".', ['mechanics']),
    T('Events', 'when ‹name› is double-clicked', 'name.addEventListener("dblclick", …)', 'Also "is focused", "is unfocused" (blur), "is scrolled"; and "when the window is resized".', ['mechanics']),
    T('Events', 'when the window has loaded', 'window.addEventListener("load", …)', 'Once everything is in, pictures too. "when the page has loaded" is sooner.', ['mechanics']),
    T('Page', 'remove ‹name› from the page', 'name.remove();', 'Takes the element off the page.', ['mechanics']),
    T('Logic', 'run this now, keeping its names private', '(function () { … })();', 'Indent the steps under it: the names made there don\'t clash with other scripts\'. "run this now, with root set to window, keeping …" gives it a value. "use strict rules" first, for "use strict".', ['mechanics']),
  ];
  const GUIDES = {
    structure: {
      name: 'HTML', purpose: 'HTML describes what is on a page: headings, text, buttons, pictures, forms, and how they are grouped. It does not decide how they look (that is CSS) or what they do (that is JavaScript).',
      rules: [['Everything is an element', 'A heading, a button, a section: each is an element with a start and an end tag.'], ['Nesting is belonging', 'Indent a line to put it inside the section, list or form above it.'], ['Names are ids', '"called save" gives an element the id `save`. Styling and Mechanics use it.'], ['Groups are classes', '"in group card" gives it the class `card`, shared by many elements.'], ['Describe pictures', 'Screen readers read the description out; search engines use it too.']],
      section: 'Structure is what is on the page, top to bottom. Indent a line to put it inside the section, list or form above it.',
    },
    styling: {
      name: 'CSS', purpose: 'CSS decides how the page looks: colours, sizes, spacing, layout, and changes for different screen sizes.',
      rules: [['Rules pick elements', 'A rule applies to one element (#save), a group (.card) or every element of a kind (button).'], ['Later wins', 'When two rules disagree, the more specific one wins, then the later one.'], ['Boxes', 'Every element is a box: space inside (padding), a border, space around (margin).'], ['Layouts adapt', '"in a row", "in a column" and grids work on every screen; exact positions often don\'t.'], ['Screens differ', 'Use "on screens narrower than 600:" to adjust for phones.']],
      section: 'Styling is how things look. Style an element by its name, a group, or every element of a kind.',
    },
    mechanics: {
      name: 'JavaScript', purpose: 'JavaScript makes the page do things: react to clicks, change what is shown, talk to a server, remember things in the browser.',
      rules: [['Events', 'Most code runs "when something happens": a click, a form being sent, the page loading.'], ['The page is live', 'Changing an element\'s text or groups updates the page straight away.'], ['Waiting', 'Talking to a server takes time; `await` waits without freezing the page.'], ['=== compares', 'In sentences you write "is"; the translator picks ===.'], ['let and const', 'Names are created with let (can change) or const (can\'t).']],
      section: 'Mechanics is what the page does. Most of it starts with "when … is clicked" or "when the page has loaded".',
    },
  };
  const WORDS = {
    structure: [['called save', 'id="save"'], ['called "helpToggle"', 'id="helpToggle" (exactly)'], ['in group card', 'class="card"'], ['hidden from screen readers', 'aria-hidden="true"'], ['storing chord "C"', 'data-chord="C"'], ['drawing', '<svg>'], ['set of shapes', '<g>'], ['big heading', '<h1>'], ['heading', '<h2>'], ['block', '<div>'], ['navigation bar', '<nav>'], ['main area', '<main>'], ['side panel', '<aside>'], ['picture', '<img>'], ['text box', '<input>'], ['big text box', '<textarea>']],
    styling: [['background navy', 'background: navy'], ['background #000 40% see-through', 'background: rgba(0,0,0,0.6)'], ['50% see-through', 'opacity: 0.5'], ['text colour white', 'color: white'], ['text size 20', 'font-size: 20px'], ['space inside 12', 'padding: 12px'], ['space around 8', 'margin: 8px'], ['rounded corners 8', 'border-radius: 8px'], ['shadow', 'box-shadow: …'], ['in a row', 'display: flex'], ['in a grid of 3 columns', 'display: grid'], ['hand cursor', 'cursor: pointer'], ['centred', 'margin: 0 auto'], ['hidden', 'display: none'], ['border 2 dashed navy', 'border: 2px dashed navy'], ['underlined', 'text-decoration: underline'], ['line height 1.5', 'line-height: 1.5'], ['text weight 600', 'font-weight: 600'], ['background gradient from #fff to #000', 'background: linear-gradient(#fff, #000)'], ['the colour main', 'var(--main)'],
      ['background royal blue', 'background: royalblue'], ['width 50 percent', 'width: 50%'], ['text size 2 em', 'font-size: 2em'], ['background rgb 255 0 0', 'background: rgb(255, 0, 0)']],
    mechanics: [['a is b', 'a === b'], ['a is not b', 'a !== b'], ['a and b', 'a && b'], ['not a', '!a'], ['length of x', 'x.length'], ['item 0 of x', 'x[0]'], ['random number from 1 to 6', 'Math.floor(Math.random()*6)+1'], ['text of name', 'name.value / .textContent'], ['"Hi {name}"', '`Hi ${name}`'], ['box is ticked', 'box.checked'], ['card is in group done', 'card.classList.contains("done")'], ['the file in picker', 'picker.files[0]'], ['wait for x', 'await x'],
      ['the result of f with a, b', 'f(a, b)'], ['a new Date', 'new Date()'], ['a if c otherwise b', 'c ? a : b'], ['an empty list', '[]'], ['x is nothing', 'x == null'], ['x is null', 'x === null'],
      ['a list of x times 2 for each x in xs', 'xs.map(x => x * 2)'], ['a list of x for each x in xs if x is more than 1', 'xs.filter(x => x > 1)'], ['the first x in xs where x is 2', 'xs.find(x => x === 2)'],
      ['x is more than 0 for every x in xs', 'xs.every(x => x > 0)'], ['x is 2 for any x in xs', 'xs.some(x => x === 2)'], ['xs joined by ", "', 'xs.join(", ")'],
      ['name trimmed', 'name.trim()'], ['line split at ","', 'line.split(",")'], ['price to 2 decimal places', 'price.toFixed(2)'], ['n rounded', 'Math.round(n)'], ['n rounded down', 'Math.floor(n)'], ['n rounded up', 'Math.ceil(n)'],
      ['text read as JSON', 'JSON.parse(text)'], ['data as JSON text', 'JSON.stringify(data)'], ['the text saved in the browser as "k"', 'localStorage.getItem("k")'],
      ['the element called "total"', 'document.getElementById("total")'], ['a new "li" element', 'document.createElement("li")'], ['the page title', 'document.title'], ['value of box', 'box.value'],
      ['the reply from "/api"', 'await fetch("/api")'], ['the JSON read from reply', 'await reply.json()'],
      ['a random whole number below 6', 'Math.floor(Math.random() * 6)'], ['a random number below 1', 'Math.random()'], ['the largest number in xs', 'Math.max(...xs)'], ['the smallest number in xs', 'Math.min(...xs)'],
      ['x, or y if that is nothing', 'x ?? y'], ['ua matches /win/i', '/win/i.test(ua)'],
      ['total price', 'totalPrice'], ['high-score', 'highScore'], ['1,000', '1000'], ['$5', '5'], ['50%', '0.5'], ['15% of total', '0.15 * total']],
  };
  const OPENS_BLOCK = /^\s*(?:when |every |after |if |otherwise|else|repeat |for each |while |define |depending on |do this|run this now|(?:constant|set) [\w$]+ (?:is|to) a tool(?!.*\sgiving back\s)|try\s*$|in any case|whatever happens|finally|add (?:a |an )?(?:section|header|footer|navigation|nav|main|block|box|area|form|side panel|sidebar|article|card|list|numbered list|table|row|pop-up|dialog|figure|collapsible section|drawing(?! area)|set of shapes|reusable parts|pattern|table head|table body|table foot|definition list|field group|quotation)\b|on screens |in dark mode)/i;

  const api = { compileWebsite, compileHtml, compileCss, compileJs, previewDocument, TEMPLATES, GUIDES, WORDS, OPENS_BLOCK, toId, TAG_WORDS,
    readAttr, sayAttr, elementWord, wordTag: (w, svg) => (svg ? SVG_WORD_TAG : HTML_WORD_TAG).get(String(w).toLowerCase()) || null, splitAnd, splitItems, strOf, quoteText,
    addressFor: (t, kind) => address(t, kind).value,
    cssPropsFor: (text, inf) => cssProps(text, inf), colorFor: (v, inf) => color(v, inf) };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.IntuiWeb = api;
})(typeof window !== 'undefined' ? window : globalThis);

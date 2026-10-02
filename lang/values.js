/* IntuCode values: the numbers, colours and keyword values in a sentence, and what is usual for each.
 * The sentence editor's "Drop down" mode puts a small box under every value: ▾ lists the values people
 * usually choose for that spot, each with a short plain label, and − / + nudge it. This file supplies the
 * knowledge; the app does the drawing.
 *   scan(line, lang)             -> [{ start, end, text, kind: number|hex|colour|word, num?, unit? }]
 *   explain(line, value, lang)   -> { title, about, options: [{ text, label, swatch? }], current, colour, step, min?, max? }
 *   step(line, value, dir, info) -> the value's new text after − (dir -1) or + (dir +1), or null
 *   toHex(name)                  -> '#rrggbb' for a colour name (or a hex code, as 6 digits), else null
 * lang is what the sentence's folder compiles to: python, html, css, js, cpp or arduino. A value's spot is
 * found from the words around it: the CSS property, the sentence it's in, the call it's an argument of, the
 * name it sets. A spot nothing is known about gets a spread of values around it. No DOM.
 */
(function () {
  'use strict';

  /* ---- colours ---- */
  const COLOURS = new Map();
  ('black 000000 white ffffff red ff0000 green 008000 blue 0000ff yellow ffff00 orange ffa500 purple 800080 pink ffc0cb ' +
    'grey 808080 gray 808080 brown a52a2a navy 000080 teal 008080 gold ffd700 silver c0c0c0 crimson dc143c coral ff7f50 ' +
    'salmon fa8072 tomato ff6347 turquoise 40e0d0 violet ee82ee indigo 4b0082 lime 00ff00 olive 808000 maroon 800000 ' +
    'beige f5f5dc ivory fffff0 lavender e6e6fa tan d2b48c khaki f0e68c aqua 00ffff cyan 00ffff magenta ff00ff ' +
    'lightgrey d3d3d3 lightgray d3d3d3 darkgrey a9a9a9 darkgray a9a9a9 whitesmoke f5f5f5 skyblue 87ceeb hotpink ff69b4 ' +
    'lightblue add8e6 darkblue 00008b lightgreen 90ee90 darkgreen 006400 darkred 8b0000 ' +
    // more CSS names, for raw CSS and drawing (the style sentences take the ones above)
    'steelblue 4682b4 royalblue 4169e1 dodgerblue 1e90ff cornflowerblue 6495ed midnightblue 191970 slategray 708090 ' +
    'slategrey 708090 dimgray 696969 dimgrey 696969 gainsboro dcdcdc firebrick b22222 orangered ff4500 darkorange ff8c00 ' +
    'goldenrod daa520 chocolate d2691e sienna a0522d forestgreen 228b22 seagreen 2e8b57 limegreen 32cd32 yellowgreen 9acd32 ' +
    'deeppink ff1493 orchid da70d6 plum dda0dd rebeccapurple 663399 mintcream f5fffa honeydew f0fff0 aliceblue f0f8ff ' +
    'ghostwhite f8f8ff linen faf0e6 wheat f5deb3 lightyellow ffffe0 lightpink ffb6c1 darkcyan 008b8b')
    .split(' ').forEach((w, i, a) => { if (i % 2 === 0) COLOURS.set(w, a[i + 1]); });
  const isColourName = (w) => w === 'transparent' || COLOURS.has(w);
  const HEX = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

  function toHex(s) {
    s = String(s == null ? '' : s).trim().toLowerCase();
    if (HEX.test(s)) { let h = s.slice(1); if (h.length <= 4) h = h.slice(0, 3).replace(/./g, d => d + d); return '#' + h.slice(0, 6); }
    const h = COLOURS.get(s.replace(/\s+/g, ''));
    return h ? '#' + h : null;
  }

  // the palettes offered for a colour: [hex, name, label]; hex codes are offered to people who wrote one, names to those who wrote a name
  const HEX_PALETTE = [['#000000', 'black'], ['#333333', 'dark grey: softer than black, for text'], ['#777777', 'mid grey: quieter text'],
    ['#dddddd', 'light grey: borders'], ['#f5f5f5', 'off-white: page backgrounds'], ['#ffffff', 'white'], ['#1e3a8a', 'deep blue'],
    ['#3b82f6', 'bright blue: links, buttons'], ['#87ceeb', 'sky blue'], ['#14b8a6', 'teal'], ['#22c55e', 'green: done, success'],
    ['#facc15', 'yellow'], ['#f97316', 'orange'], ['#ef4444', 'red: warnings, errors'], ['#8b5cf6', 'purple']];
  const NAME_PALETTE = [['black', 'darkest'], ['grey', 'mid grey'], ['lightgrey', 'pale grey: borders'], ['whitesmoke', 'off-white: backgrounds'],
    ['white', 'lightest'], ['navy', 'deep blue'], ['blue', 'pure blue'], ['skyblue', 'pale blue: skies'], ['teal', 'blue-green'],
    ['green', 'mid green'], ['gold', 'warm yellow'], ['orange', 'orange'], ['tomato', 'soft red'], ['crimson', 'deep red'],
    ['purple', 'purple'], ['hotpink', 'bright pink']];

  /* ---- reading a line ---- */
  const COMMENT = /^\s*(?:(?:note|comment|teach|description|summary|learn)\s*:|#|\/\/)/i;
  const RAW = /^(\s*)(raw python|python|javascript|js|css|c\+\+|cpp|raw|html|head)\s*:/i;
  const UNITS = new Set(['', 'px', 'em', 'rem', '%', 'vh', 'vw', 'vmin', 'vmax', 'dvh', 'svh', 'lvh', 's', 'ms', 'deg', 'turn', 'rad', 'fr', 'ch', 'ex', 'pt', 'cm', 'mm', 'hz', 'khz']);
  const rawLang = (w, lang) => ({ 'raw python': 'python', python: 'python', javascript: 'js', js: 'js', css: 'css', html: 'html', head: 'html' })[w.toLowerCase()]
    || (/^c/i.test(w) && lang !== 'arduino' ? 'cpp' : lang);

  /* The line with quoted text and ‹slots› hidden (same length; quote marks kept), and where each quoted text is. */
  function mask(line, code, head) {
    let t = '';
    const quotes = [];
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '‹') { const e = line.indexOf('›', i); if (e > i) { t += '\u0001'.repeat(e - i + 1); i = e; continue; } }
      if (c === '"' || c === '`' || (c === "'" && !/[A-Za-z0-9]/.test(line[i - 1] || ''))) {
        let j = i + 1;
        while (j < line.length && line[j] !== c) j += line[j] === '\\' ? 2 : 1;
        if (j >= line.length && c === "'") { t += c; continue; }   // an apostrophe
        j = Math.min(j, line.length);
        quotes.push([i + 1, j]);
        t += c + '\u0001'.repeat(j - i - 1) + (j < line.length ? c : '');
        i = j; continue;
      }
      t += c;
    }
    // a comment at the end of a line of code
    const cut = code === 'python' ? t.indexOf('#', head) : code && code !== 'css' && code !== 'html' ? t.indexOf('//', head) : -1;
    if (cut >= 0) t = t.slice(0, cut) + '\u0001'.repeat(t.length - cut);
    return { t, quotes };
  }

  /* In CSS, where the selector ends ("style the page:", "css: p {"): anything before it is not a value. */
  function selectorEnd(t, raw, head) {
    if (raw) { const b = t.indexOf('{', head); return b > 0 && !/@/.test(t.slice(head, b)) ? b + 1 : head; }
    const m = t.match(/^\s*(?:style|make|give|(?:create|make)\s+(?:a\s+)?group|when)\b[^:]*:/i);
    return m ? m[0].length : 0;
  }

  /* A '-' at t[k], just before a number: a sign ("at -10", "margin -4"), or a subtraction ("x-1")? */
  function isSign(t, k) {
    const p = t[k - 1];
    return p === undefined || !/[\w$)\]\u0001"'`.%-]/.test(p);
  }

  /* The CSS property a value belongs to, from the text before it in its part: "text-align: " or "cursor ". */
  function cssPropOf(seg) {
    const m = seg.match(/^\s*(-{0,2}[a-z][a-z-]*)\s*:?\s+(?:[\w#.%-]+\s+)*$/i);
    return m ? m[1].toLowerCase() : null;
  }
  /* Where the part a value is in begins: back to a comma, semicolon or open bracket at its own depth. */
  function partStart(t, at, lead) {
    for (let i = at - 1, depth = 0; i >= lead; i--) {
      const ch = t[i];
      if (ch === ')' || ch === ']' || ch === '}') depth++;
      else if (ch === '(' || ch === '[' || ch === '{') { if (depth) depth--; else return i + 1; }
      else if (!depth && (ch === ',' || ch === ';')) return i + 1;
    }
    return lead;
  }

  // keyword values for CSS properties (filled in with the catalogue below)
  const WORDS = {};
  const BORDER_STYLES = ['solid', 'dashed', 'dotted', 'double', 'groove', 'ridge', 'inset', 'outset', 'none', 'hidden'];
  const TIMING = ['ease', 'linear', 'ease-in', 'ease-out', 'ease-in-out', 'step-start', 'step-end'];
  const BORDERISH = /^(?:border(?:-top|-right|-bottom|-left)?|outline|column-rule)$/;
  const TEXT_BEFORE = /\b(?:show|print|say|display|saying|says|heading|paragraph|button|text|label|labelled|title|item|message|write|ask)\s*$/i;

  function scan(line, lang) {
    line = String(line == null ? '' : line);
    const out = [];
    if (!line.trim() || COMMENT.test(line)) return out;
    const r = line.match(RAW);
    const code = r ? rawLang(r[2], lang) : lang;
    const head = r ? r[0].length : 0;
    const { t, quotes } = mask(line, r ? code : null, head);
    const css = code === 'css';
    const sel = css ? selectorEnd(t, !!r, head) : head;
    const push = (v) => out.push(v);
    // a quoted text that is all a colour: "tomato", "#87ceeb"
    for (const [a, b] of quotes) {
      if (a < sel || b > line.length) continue;
      const s = line.slice(a, b);
      if (HEX.test(s)) push({ start: a, end: b, text: s, kind: 'hex' });
      else if (isColourName(s.toLowerCase()) && !TEXT_BEFORE.test(t.slice(0, a - 1))) push({ start: a, end: b, text: s, kind: 'colour' });
    }
    const re = /#[0-9a-fA-F]+|(?:\d+(?:\.\d+)*|\.\d+)(?:[eE][+-]?\d+)?[A-Za-z%]*|[A-Za-z_$][\w$]*(?:-[A-Za-z_][\w$]*)*/g;
    let m;
    while ((m = re.exec(t))) {
      const w = m[0], at = m.index, end = at + w.length, prev = t[at - 1] || '';
      if (at < sel) continue;
      if (w[0] === '#') {
        if (HEX.test(w) && !/[\w&$]/.test(prev) && !/[\w-]/.test(t[end] || '')) push({ start: at, end, text: w, kind: 'hex' });
        continue;
      }
      if (/^[\d.]/.test(w)) {
        if (/[\w$#.]/.test(prev)) continue;                                    // part of a name: player2, h1, x.5
        if (prev === '-' && /\w/.test(t[at - 2] || '') && (css || code === 'html')) continue;   // a CSS or HTML name: photo-1, col-2
        const n = w.match(/^((?:\d+(?:\.\d+)*|\.\d+)(?:[eE][+-]?\d+)?)(.*)$/);
        if ((n[1].match(/\./g) || []).length > 1 || !UNITS.has(n[2].toLowerCase())) continue;   // 1.2.3, 2nd, 3D
        const start = prev === '-' && isSign(t, at - 1) ? at - 1 : at;
        push({ start, end, text: line.slice(start, end), kind: 'number', num: parseFloat(line.slice(start, at + n[1].length)), unit: n[2] });
        continue;
      }
      const low = w.toLowerCase(), before = t.slice(0, at), after = t.slice(end);
      if (lang === 'arduino' && /^A[0-7]$/.test(w) && /(?:\bpin\s+|analogRead\s*\(\s*)$/i.test(before)) { push({ start: at, end, text: w, kind: 'word' }); continue; }
      if (isColourName(low) && !/[-.#$@]/.test(prev)) {
        const spot = css ? !/\b(?:the|shared|main)\s+colou?r\s+$/i.test(before) && !/^\s*[(=]/.test(after)
          : code === 'js' && ((/\bin\s+$/i.test(before) && /^\s+on\b/i.test(after)) || /^\s*fill\s+\S+\s+with\s+$/i.test(before));
        if (spot) { push({ start: at, end, text: w, kind: 'colour' }); continue; }
      }
      if (css) {
        const prop = cssPropOf(t.slice(Math.max(sel, partStart(t, at, sel)), at));
        if (prop && prop !== low && !isColourName(low) && (WORDS[prop] || (BORDERISH.test(prop) && BORDER_STYLES.includes(low)) || (/^(?:transition|animation)$/.test(prop) && TIMING.includes(low)))) {
          push({ start: at, end, text: w, kind: 'word' });
        }
      }
    }
    return out.sort((a, b) => a.start - b.start);
  }

  /* ---- numbers as text ---- */
  const decimals = (x) => { const m = String(x).match(/\.(\d+)/); return m ? m[1].length : 0; };
  const fmt = (n, d) => { let s = d == null ? String(+(+n).toFixed(10)) : (+n).toFixed(d); if (/\./.test(s)) s = s.replace(/\.?0+$/, ''); return s === '-0' ? '0' : s; };
  const numPart = (v) => v.text.slice(0, v.text.length - (v.unit || '').length);
  const defaultStep = (v) => { const d = decimals(numPart(v)); return d ? +Math.pow(10, -d).toFixed(d) : 1; };

  /* ---- what is around a value ---- */
  function context(line, v, lang) {
    line = String(line == null ? '' : line);
    const r = line.match(RAW);
    const code = r ? rawLang(r[2], lang) : lang;
    const head = r ? r[0].length : 0;
    const { t } = mask(line, r ? code : null, head);
    const css = code === 'css';
    const sel = css ? selectorEnd(t, !!r, head) : head;
    const lead = Math.max(sel, t.match(/^\s*/)[0].length);
    const quoted = v.kind !== 'number' && /["'`]/.test(line[v.start - 1] || '') && line[v.end] === line[v.start - 1];
    const s0 = quoted ? v.start - 1 : v.start, e0 = quoted ? v.end + 1 : v.end;
    const ps = Math.max(lead, partStart(t, s0, lead));
    const c = {
      line, lang, code, v, t, css, raw: !!r, quoted, s0, e0,
      n: v.num, unit: (v.unit || '').toLowerCase(),
      before: t.slice(lead, s0), after: t.slice(e0),
      seg: t.slice(ps, s0), opener: t[ps - 1] || '',
    };
    c.pre = c.seg.replace(/^\s+/, '').toLowerCase();
    let k = e0, depth = 0;
    for (; k < t.length; k++) { const ch = t[k]; if ('([{'.includes(ch)) depth++; else if (')]}'.includes(ch)) { if (!depth) break; depth--; } else if (!depth && (ch === ',' || ch === ';')) break; }
    c.segAfter = t.slice(e0, k);
    c.prop = css ? cssPropOf(c.seg) : null;
    c.call = callAt(t, s0, lead);
    const kw = c.seg.match(/([A-Za-z_]\w*)\s*(?:=(?!=)|:)\s*$/);
    c.kw = kw && !css ? kw[1] : null;
    c.whole = !/\S/.test(c.segAfter.replace(/^\s*;?\s*/, '')) && !/\S/.test(c.after.replace(/^[\s;,)\]}]*$/, ''));
    c.setName = setName(c.before);
    return c;
  }
  /* The call a value is an argument of: f(a, b), or the sentence "run f with a, b". */
  function callAt(t, at, lead) {
    let n = 0;
    for (let i = at - 1, depth = 0; i >= lead; i--) {
      const ch = t[i];
      if (ch === ')' || ch === ']' || ch === '}') depth++;
      else if (ch === '[' || ch === '{') { if (depth) depth--; else return null; }
      else if (ch === '(') {
        if (depth) { depth--; continue; }
        const pre = t.slice(lead, i);
        const f = pre.match(/([A-Za-z_$][\w$.]*)$/), kw = pre.match(/([A-Za-z_]\w*)\s*=\s*$/);
        return { fn: f ? f[1] : '', name: f ? f[1].split('.').pop() : '', arg: n, kw: kw ? kw[1] : null };
      } else if (ch === ',' && !depth) n++;
    }
    const m = t.slice(lead, at).match(/^\s*(?:run|call|do|use|perform)\s+(?:the\s+)?(?:tool\s+)?([A-Za-z_$][\w$.]*)\s+(?:with|using)\s+(.*)$/i);
    if (!m) return null;
    let depth = 0, k = 0;
    for (const ch of m[2]) { if ('([{'.includes(ch)) depth++; else if (')]}'.includes(ch)) depth--; else if (ch === ',' && !depth) k++; }
    return { fn: m[1], name: m[1].split('.').pop(), arg: k, kw: null };
  }
  /* The name a sentence or line sets, when the value comes straight after: "set score to", "lives =", "int pin =". */
  function setName(before) {
    const m = before.match(/^\s*(?:set|make|let|change|update)\s+(.+?)\s+(?:to be|to|be|equal to|equal|=)\s*$/i)
      || before.match(/^\s*(?:make|constant)\s+([A-Za-z_][\w]*)\s+(?:is\s+)?$/i)
      || before.match(/^\s*#define\s+([A-Za-z_]\w*)\s+$/)
      || before.match(/^\s*(?:(?:let|const|var|static|unsigned|long|short|signed|const|constexpr|volatile)\s+)*(?:(?:int|long|float|double|byte|bool|auto|char|uint8_t|uint16_t|int16_t|uint32_t|size_t|word)\s+)?([A-Za-z_$][\w$.]*)\s*(?:=(?!=)|\bis\b)\s*$/);
    return m ? m[1].trim() : null;
  }
  const nameKey = (s) => String(s || '').toLowerCase().replace(/[\s_.-]+/g, '');

  /* ---- the catalogue: what each spot is, and what's usual there ---- */
  // a spot: { title, about, opts: [[n, label]] or (c) => [...], units: { unit: [[n, label]] }, step, min, max, len (a CSS length: px in raw CSS) }
  const S = {};

  S.fontSize = { title: 'Text size', len: true, step: 1, min: 0,
    about: 'How big the letters are, in pixels unless another unit is given. 16 is the browser\'s usual size for body text; headings are usually 24 and up.',
    opts: [[12, 'small print'], [14, 'small: captions, notes'], [16, 'body text (the browser\'s usual)'], [18, 'large body text'], [20, 'lead paragraph'],
      [24, 'small heading'], [32, 'heading'], [48, 'big heading'], [64, 'title on a big banner']],
    units: { em: [[0.75, 'small print'], [0.875, 'small'], [1, 'same as around it'], [1.25, 'a little bigger'], [1.5, 'small heading'], [2, 'heading'], [3, 'big heading']],
      '%': [[75, 'small print'], [87.5, 'small'], [100, 'same as around it'], [125, 'a little bigger'], [150, 'small heading'], [200, 'heading']] },
    steps: { em: 0.125, rem: 0.125, '%': 5 } };
  S.fontSize.units.rem = S.fontSize.units.em;

  S.lineHeight = { title: 'Line height', step: 0.1, min: 0,
    about: 'The room each line of text takes, as a multiple of the text size: 1.5 means one and a half times the text\'s height. Around 1.5 reads comfortably; headings sit tighter.',
    opts: [[1, 'tight: big headings'], [1.1, 'snug: headings'], [1.2, 'compact: headings, buttons'], [1.3, 'a little room'], [1.4, 'fairly open'],
      [1.5, 'comfortable: paragraphs (the usual)'], [1.6, 'airy: long reading'], [1.8, 'very open'], [2, 'double spacing']],
    units: { px: [[16, 'tight for 16px text'], [20, 'snug for 16px text'], [24, 'comfortable for 16px text'], [28, 'airy for 16px text'], [32, 'double for 16px text']],
      '%': [[100, 'tight'], [120, 'compact'], [150, 'comfortable (the usual)'], [160, 'airy'], [200, 'double spacing']] },
    steps: { px: 1, '%': 5 } };
  S.lineHeight.units.em = S.lineHeight.opts;
  S.lineHeight.units.rem = S.lineHeight.opts;

  S.letterSpacing = { title: 'Letter spacing', len: true, step: 0.5,
    about: 'Extra room between letters. 0 is the font\'s own spacing; a little more opens up capitals and small labels, and a little less pulls big headings together.',
    opts: [[-1, 'tighter: big headings'], [0, 'the font\'s own (normal)'], [0.5, 'a touch more'], [1, 'open: small capitals'], [2, 'wide: labels in capitals'], [4, 'very wide']],
    units: { em: [[-0.02, 'tighter: big headings'], [0, 'the font\'s own (normal)'], [0.02, 'a touch more'], [0.05, 'open'], [0.1, 'wide: capitals'], [0.2, 'very wide']] },
    steps: { em: 0.01, rem: 0.01 } };
  S.fontWeight = { title: 'Boldness', step: 100, min: 100, max: 900,
    about: 'How heavy the letters are, from 100 (thinnest) to 900 (heaviest). 400 is normal and 700 is bold; the weights in between only show if the font has them.',
    opts: [[100, 'thin'], [200, 'extra light'], [300, 'light'], [400, 'normal'], [500, 'medium'], [600, 'semi-bold'], [700, 'bold'], [800, 'extra bold'], [900, 'black: the heaviest']] };
  const SPACE = [[0, 'none'], [4, 'a sliver'], [8, 'tight: small buttons, tags'], [12, 'snug'], [16, 'comfortable: cards, buttons (common)'], [24, 'roomy'], [32, 'spacious: panels'], [48, 'big: page sections'], [64, 'very big: banners']];
  const SPACE_EM = [[0, 'none'], [0.25, 'a sliver'], [0.5, 'tight'], [0.75, 'snug'], [1, 'one text height (common)'], [1.5, 'roomy'], [2, 'spacious'], [3, 'big']];
  S.padding = { title: 'Space inside', len: true, step: 1, min: 0, units: { em: SPACE_EM, rem: SPACE_EM }, steps: { em: 0.25, rem: 0.25 },
    about: 'Room between the edge of the box and what\'s inside it, in pixels unless another unit is given. With more than one number they go round the sides: top, right, bottom, left.',
    opts: SPACE };
  S.margin = { title: 'Space around', len: true, step: 1, units: { em: SPACE_EM, rem: SPACE_EM }, steps: { em: 0.25, rem: 0.25 },
    about: 'Room outside the box\'s edge, keeping its neighbours away, in pixels unless another unit is given. With more than one number they go round the sides: top, right, bottom, left. "auto" left and right centres a box that has a width.',
    opts: [[0, 'none: touching its neighbours'], [4, 'a sliver'], [8, 'tight'], [12, 'snug'], [16, 'about a line of text (common)'], [24, 'roomy'], [32, 'between sections'], [48, 'big gap'], [64, 'very big gap']] };
  S.radius = { title: 'Rounded corners', len: true, step: 1, min: 0,
    about: 'How round the corners are: the radius of the curve, in pixels. 0 is square; 999 turns a short box into a pill; 50% makes a square into a circle.',
    opts: [[0, 'square corners'], [2, 'barely rounded'], [4, 'slightly rounded: text boxes'], [6, 'gently rounded'], [8, 'rounded: buttons, cards (common)'], [12, 'soft'], [16, 'very soft: panels'], [24, 'big curve'], [999, 'pill: fully round ends']],
    units: { '%': [[0, 'square corners'], [10, 'slightly rounded'], [25, 'very rounded'], [50, 'a circle (on a square), an oval otherwise']] }, steps: { '%': 5 } };
  S.borderWidth = { title: 'Border width', len: true, step: 1, min: 0,
    about: 'How thick the line round the edge is, in pixels. 1 is a fine line; 2 or 3 stands out.',
    opts: [[0, 'no border'], [1, 'fine line (the usual)'], [2, 'clear'], [3, 'bold'], [4, 'thick'], [6, 'very thick'], [8, 'chunky']] };
  const PCT_W = [[25, 'a quarter'], [33, 'about a third'], [50, 'half'], [66, 'about two thirds'], [75, 'three quarters'], [90, 'most of it'], [100, 'all of the space it\'s in']];
  const WIDTH_NOTE = ' For reference: phones are about 360 wide, tablets 768, laptops 1280.';
  S.width = { title: 'Width', len: true, step: 1, min: 0,
    about: 'How wide the box is, in pixels unless another unit is given; % is a share of the space it sits in.' + WIDTH_NOTE,
    opts: [[120, 'a small box'], [240, 'a narrow sidebar'], [320, 'a card'], [360, 'a phone screen'], [480, 'a small dialog'], [600, 'a reading column'], [768, 'a tablet screen'], [960, 'a classic page'], [1200, 'a wide page'], [1280, 'a laptop screen']],
    units: { '%': PCT_W, vw: [[25, 'a quarter of the screen'], [50, 'half the screen'], [80, 'most of the screen'], [90, 'nearly all of it'], [100, 'the whole screen width']], em: [[10, 'a narrow box'], [20, 'a card'], [30, 'a dialog'], [40, 'a reading column'], [60, 'a page']] },
    steps: { '%': 5, vw: 5 } };
  S.maxWidth = { ...S.width, title: 'Widest it gets',
    about: 'The box can be narrower than this but never wider, so it stays readable on big screens. A reading column is usually 600 to 800 (60 to 75 letters a line).' + WIDTH_NOTE,
    opts: [[320, 'a card'], [480, 'a small dialog'], [600, 'a reading column'], [720, 'a roomy column'], [800, 'a wide column'], [960, 'a classic page'], [1100, 'a wide page'], [1200, 'a wide page'], [1280, 'a laptop screen']] };
  S.minWidth = { ...S.width, title: 'Narrowest it gets', about: 'The box can be wider than this but never narrower, so its contents don\'t get squashed.' + WIDTH_NOTE,
    opts: [[0, 'no limit'], [44, 'a comfortable tap target'], [120, 'a button'], [200, 'a small box'], [280, 'a card'], [320, 'a phone, at its narrowest']] };
  const H_VH = [[25, 'a quarter of the screen'], [50, 'half the screen'], [75, 'three quarters of the screen'], [100, 'the whole screen height']];
  S.height = { title: 'Height', len: true, step: 1, min: 0, units: { vh: H_VH, '%': [[50, 'half'], [100, 'all of the space it\'s in']] }, steps: { vh: 5, '%': 5 },
    about: 'How tall the box is, in pixels unless another unit is given; vh is a share of the screen\'s height. Usually it\'s best left to fit its contents.',
    opts: [[24, 'a slim bar'], [40, 'a button'], [48, 'a comfortable tap target'], [64, 'a toolbar'], [100, 'a small box'], [200, 'a picture strip'], [300, 'a panel'], [400, 'a big panel'], [600, 'most of a laptop screen']] };
  S.minHeight = { ...S.height, title: 'Shortest it gets', about: 'The box can grow taller to fit its contents but is never shorter than this. 100vh fills the screen.',
    opts: [[44, 'a tap target'], [100, 'a small box'], [200, 'a panel'], [300, 'a tall panel'], [400, 'a banner'], [600, 'most of a laptop screen']] };
  S.maxHeight = { ...S.height, title: 'Tallest it gets', about: 'The box can be shorter but never taller than this; with overflow: auto it scrolls past it.' };
  S.gap = { title: 'Space between', len: true, step: 1, min: 0, units: { em: SPACE_EM, rem: SPACE_EM }, steps: { em: 0.25, rem: 0.25 },
    about: 'Room between the items in a row, column or grid, in pixels unless another unit is given. It only goes between items, never at the outer edges.',
    opts: [[0, 'touching'], [4, 'a sliver'], [8, 'tight'], [12, 'snug'], [16, 'comfortable (common)'], [24, 'roomy'], [32, 'spacious'], [48, 'far apart']] };

  /* Which side a number is for, when a padding or margin has several. */
  function sides(spot, c, re) {
    const m = c.pre.match(re);
    if (!m) return spot;
    const k = (m[1].match(/\S+/g) || []).length, n = k + 1 + (c.segAfter.match(/^\s*((?:[-\d.]+[a-z%]*|auto)\s*)*/i)[0].match(/\S+/g) || []).length;
    const names = { 2: ['top and bottom', 'left and right'], 3: ['top', 'left and right', 'bottom'], 4: ['top', 'right', 'bottom', 'left'] }[n];
    return names && names[k] ? { ...spot, title: `${spot.title} (${names[k]})` } : spot;
  }

  /* The spot for a value, from its context: the first rule that knows it. Rules are added in batches below. */
  const RULES = [];
  const rule = (fn) => RULES.push(fn);
  function spotFor(c) {
    for (const r of RULES) { const s = r(c); if (s) return s; }
    return null;
  }
  const CSS_SIDES = /^(?:-(?:top|right|bottom|left|block|inline)(?:-(?:start|end))?)?$/;
  // CSS: text and boxes
  rule((c) => {
    if (!c.css || c.v.kind !== 'number') return null;
    const p = c.prop || '', w = c.pre;
    if (/^(?:max|min)-width$/.test(p) && /@media/i.test(c.line) || /^on (?:screens|phones|devices) (?:narrower|smaller|wider|bigger) than\s+$/.test(w)) return S.screen;
    if (p === 'font-size' || /^(?:text size|font size|size of text)\s+$/.test(w)) return S.fontSize;
    if (p === 'line-height' || /^line (?:height|spacing)\s+$/.test(w)) return S.lineHeight;
    if (p === 'letter-spacing' || /^letter spacing\s+$/.test(w)) return S.letterSpacing;
    if (p === 'font-weight') return S.fontWeight;
    if (/^padding/.test(p) && CSS_SIDES.test(p.slice(7)) || /^(?:space inside|inner space)\s/.test(w)) return sides(S.padding, c, /^(?:space inside|inner space|padding)\s*:?\s+(.*)$/);
    if (/^margin/.test(p) && CSS_SIDES.test(p.slice(6)) || /^(?:space around|outer space)\s/.test(w)) return sides(S.margin, c, /^(?:space around|outer space|margin)\s*:?\s+(.*)$/);
    if (/radius$/.test(p) || /^(?:rounded corners?|round corners?)\s+$/.test(w)) return S.radius;
    if (/^(?:border|outline)(?:-top|-right|-bottom|-left)?(?:-width)?$/.test(p) || p === 'column-rule') return { ...S.borderWidth, title: /^outline/.test(p) ? 'Outline width' : 'Border width' };
    if (p === 'width' || p === 'inline-size' || p === 'flex-basis') return S.width;
    if (p === 'max-width' || p === 'max-inline-size' || /^at most\s+$/.test(w) && /^\s*wide\b/i.test(c.after)) return S.maxWidth;
    if (p === 'min-width' || p === 'min-inline-size' || /^at least\s+$/.test(w) && /^\s*wide\b/i.test(c.after)) return S.minWidth;
    if (p === 'height' || p === 'block-size') return S.height;
    if (p === 'min-height' || p === 'min-block-size' || /^at least\s+$/.test(w) && /^\s*tall\b/i.test(c.after)) return S.minHeight;
    if (p === 'max-height' || p === 'max-block-size' || /^at most\s+$/.test(w) && /^\s*tall\b/i.test(c.after)) return S.maxHeight;
    if (/^(?:gap|row-gap|column-gap|grid-gap)$/.test(p) || /^space between\s+$/.test(w)) return S.gap;
    return null;
  });

  S.opacity = { title: 'Opacity', step: 0.05, min: 0, max: 1,
    about: 'How solid the whole thing is, from 0 (invisible) to 1 (fully solid). It fades everything inside too, text included.',
    opts: [[0, 'invisible (still takes up room)'], [0.1, 'a faint trace'], [0.25, 'faint'], [0.5, 'half see-through'], [0.75, 'slightly faded'], [0.9, 'barely faded'], [1, 'solid (the usual)']],
    units: { '%': [[0, 'invisible'], [25, 'faint'], [50, 'half'], [75, 'slightly faded'], [100, 'solid']] }, steps: { '%': 5 } };
  S.seeThrough = { title: 'How see-through', step: 5, min: 0, max: 100,
    about: 'How much shows through it: 0% is solid, 100% invisible. It fades everything inside, text included; to fade only the background, put it after the background colour instead.',
    opts: [[0, 'solid'], [10, 'barely'], [25, 'a little'], [40, 'noticeably'], [50, 'half'], [75, 'mostly'], [90, 'faint'], [100, 'invisible']] };
  S.seeThrough.base = '%';
  S.bgSeeThrough = { ...S.seeThrough, about: 'How much shows through the background: 0% is solid, 100% invisible. Only the background fades; the text inside stays solid.' };
  S.shadowStrength = { title: 'Shadow strength', step: 5, min: 0, max: 100, base: '%',
    about: 'How dark the shadow is, from 0% (none) to 100% (solid colour). Soft shadows of 15% to 30% look the most natural.',
    opts: [[10, 'very faint'], [15, 'soft'], [25, 'gentle (like the usual shadow)'], [40, 'clear'], [60, 'strong'], [80, 'heavy'], [100, 'solid colour']] };
  S.zIndex = { title: 'Stacking order', step: 1,
    about: 'Which things sit on top where they overlap: higher numbers are nearer the front. It only works on things with a position (relative, absolute, fixed or sticky) or inside a flex or grid.',
    opts: [[-1, 'behind the others'], [0, 'the usual layer'], [1, 'a step above its neighbours'], [10, 'above most things: sticky headers'], [100, 'menus, pop-overs'], [1000, 'over everything: dialogs']] };
  S.gridColumns = { title: 'Columns in the grid', step: 1, min: 1,
    about: 'How many equal columns the items are laid out in; they fill in left to right, then start a new row.',
    opts: [[1, 'a single column, like a list'], [2, 'two side by side'], [3, 'a row of cards (common)'], [4, 'a gallery'], [5, 'a busy gallery'], [6, 'thumbnails'], [12, 'a 12-column layout grid']] };
  S.duration = { title: 'How long a change takes', step: 0.05, min: 0, base: 's',
    about: 'How long the change takes, in seconds (s) or milliseconds (ms). 0.2s feels quick and smooth; much over 0.5s starts to feel slow.',
    opts: [[0.1, 'very quick'], [0.15, 'quick'], [0.2, 'snappy: hover effects (common)'], [0.3, 'smooth'], [0.5, 'slow'], [1, 'very slow'], [2, 'a long fade']],
    units: { s: null, ms: [[100, 'very quick'], [150, 'quick'], [200, 'snappy: hover effects (common)'], [300, 'smooth'], [500, 'slow'], [1000, 'very slow']] },
    steps: { ms: 50 } };
  S.duration.units.s = S.duration.opts;
  S.delay = { ...S.duration, title: 'Wait before it starts', about: 'How long to wait before the change or animation starts, in seconds (s) or milliseconds (ms).',
    opts: [[0, 'straight away'], [0.1, 'a moment'], [0.2, 'a beat'], [0.5, 'half a second'], [1, 'a second'], [2, 'two seconds']] };
  S.delay.units = { s: S.delay.opts, ms: [[0, 'straight away'], [100, 'a moment'], [200, 'a beat'], [500, 'half a second'], [1000, 'a second']] };
  S.offset = { title: 'Distance from the edge', len: true, step: 1,
    about: 'How far from the edge of the box it is placed in, in pixels unless another unit is given. Exact positions can overlap other things on small screens.',
    opts: [[0, 'right at the edge'], [8, 'close to the edge'], [10, ''], [16, 'a little in'], [20, ''], [24, 'clear of the edge'], [50, ''], [100, ''], [200, '']],
    units: { '%': [[0, 'at the edge'], [25, 'a quarter of the way'], [50, 'halfway'], [75, 'three quarters of the way'], [100, 'the far edge']] }, steps: { '%': 5 } };
  S.screen = { title: 'Screen width', len: true, step: 1, min: 0,
    about: 'The screen width where these styles switch on or off, in pixels. Phones are up to about 480 wide, tablets around 768, laptops 1280 and up.',
    opts: [[480, 'phones'], [600, 'big phones'], [768, 'tablets'], [1024, 'tablets sideways, small laptops'], [1280, 'laptops'], [1440, 'big screens']] };
  S.turn = { title: 'Turn', step: 1, base: 'deg',
    about: 'How far it is turned, clockwise, in degrees: 90 is a quarter turn, 180 upside down, 360 all the way round.',
    opts: [[-90, 'a quarter turn back'], [-45, 'an eighth back'], [0, 'not turned'], [45, 'an eighth of a turn'], [90, 'a quarter turn'], [180, 'upside down'], [270, 'three quarters'], [360, 'all the way round']],
    units: { deg: null, turn: [[0, 'not turned'], [0.125, 'an eighth'], [0.25, 'a quarter turn'], [0.5, 'half a turn'], [1, 'all the way round']] }, steps: { turn: 0.125 } };
  S.turn.units.deg = S.turn.opts;
  S.gradient = { title: 'Gradient direction', step: 5, base: 'deg', about: 'Which way the colours run, as an angle: 180deg is top to bottom (the usual), 90deg left to right.',
    opts: [[0, 'bottom to top'], [45, 'bottom-left to top-right'], [90, 'left to right'], [135, 'top-left to bottom-right'], [180, 'top to bottom (the usual)'], [225, 'top-right to bottom-left'], [270, 'right to left']] };
  S.gradient.units = { deg: S.gradient.opts };
  S.scale = { title: 'Size, as a multiple', step: 0.05, min: 0,
    about: 'How big it is drawn compared with its usual size: 1 is as it is, 2 twice as big, 0.5 half. Other things don\'t move out of the way.',
    opts: [[0.5, 'half size'], [0.9, 'a little smaller: pressed'], [0.95, 'slightly smaller'], [1, 'its usual size'], [1.05, 'slightly bigger: hover'], [1.1, 'a little bigger'], [1.25, 'a quarter bigger'], [1.5, 'half as big again'], [2, 'twice the size']] };
  S.channel = (name) => ({ title: `${name} amount`, step: 1, min: 0, max: 255,
    about: `How much ${name.toLowerCase()} is in the colour, from 0 (none) to 255 (full). rgb(0, 0, 0) is black and rgb(255, 255, 255) white.`,
    opts: [[0, 'none'], [32, 'a trace'], [64, 'a quarter'], [128, 'half'], [192, 'three quarters'], [255, 'full']],
    units: { '%': [[0, 'none'], [25, 'a quarter'], [50, 'half'], [75, 'three quarters'], [100, 'full']] }, steps: { '%': 5 } });
  S.alpha = { title: 'How solid the colour is', step: 0.05, min: 0, max: 1,
    about: 'The colour\'s opacity, from 0 (invisible) to 1 (solid). Only this colour fades, not the rest of the element.',
    opts: [[0, 'invisible'], [0.1, 'a faint tint'], [0.25, 'faint'], [0.5, 'half'], [0.75, 'mostly solid'], [0.9, 'nearly solid'], [1, 'solid']],
    units: { '%': [[0, 'invisible'], [25, 'faint'], [50, 'half'], [75, 'mostly solid'], [100, 'solid']] }, steps: { '%': 5 } };
  S.hue = { title: 'Hue', step: 5, min: 0, max: 360, base: 'deg',
    about: 'The colour, as an angle round the colour wheel: 0 red, 60 yellow, 120 green, 180 cyan, 240 blue, 300 magenta.',
    opts: [[0, 'red'], [30, 'orange'], [60, 'yellow'], [120, 'green'], [180, 'cyan'], [210, 'sky blue'], [240, 'blue'], [270, 'purple'], [300, 'magenta'], [330, 'pink']] };
  S.hue.units = { deg: S.hue.opts };
  S.saturation = { title: 'Saturation', step: 5, min: 0, max: 100, base: '%', about: 'How strong the colour is: 0% is grey, 100% the most vivid.',
    opts: [[0, 'grey'], [20, 'muted'], [40, 'soft'], [60, 'clear'], [80, 'rich'], [100, 'the most vivid']] };
  S.lightness = { title: 'Lightness', step: 5, min: 0, max: 100, base: '%', about: 'How light the colour is: 0% is black, 50% the colour itself, 100% white.',
    opts: [[0, 'black'], [15, 'very dark'], [30, 'dark'], [50, 'the colour itself'], [70, 'light'], [85, 'pale'], [95, 'a tint'], [100, 'white']] };
  S.shadowPart = (k) => ({ title: ['Shadow: sideways offset', 'Shadow: downwards offset', 'Shadow: blur', 'Shadow: spread'][k], len: true, step: 1, min: k === 2 ? 0 : undefined,
    about: ['How far the shadow sits to the right, in pixels (negative: to the left). 0 keeps it centred, as if lit from above.',
      'How far the shadow drops below, in pixels (negative: above). 2 to 8 looks like a card resting on the page.',
      'How soft the shadow\'s edge is, in pixels: 0 is a hard edge, bigger is softer and wider.',
      'How much bigger than the box the shadow is, in pixels, before blurring (negative: smaller).'][k],
    opts: k === 2 ? [[0, 'a hard edge'], [4, 'a little soft'], [8, 'soft'], [12, 'softer (common)'], [24, 'very soft'], [32, 'a glow']]
      : k === 3 ? [[-4, 'tucked in'], [0, 'the same size (usual)'], [2, 'a little bigger'], [4, 'an outline-like ring']]
        : [[-4, ''], [0, 'centred (lit from above)'], [1, ''], [2, 'barely lifted'], [4, 'lifted (common)'], [8, 'raised'], [12, 'floating']] });
  S.grow = { title: 'Share of the spare room', step: 1, min: 0,
    about: 'How much of the leftover space in a row or column this item takes, compared with the others: 0 takes none, and an item with 2 gets twice as much as one with 1.',
    opts: [[0, 'none: stays its own size'], [1, 'an equal share (common)'], [2, 'a double share'], [3, 'a triple share']] };
  S.blur = { title: 'Blur', len: true, step: 1, min: 0, about: 'How blurred it is, in pixels: 0 is sharp; 4 to 10 frosts the glass behind a panel.',
    opts: [[0, 'sharp'], [2, 'slightly soft'], [4, 'soft'], [8, 'frosted'], [12, 'very frosted'], [20, 'a smear']] };
  S.ratio = { title: 'Shape (width / height)', step: 1, min: 1, about: 'The box\'s shape as width / height: 16 / 9 is widescreen, 4 / 3 a classic screen, 1 / 1 a square.',
    opts: [[1, 'square, or the 1 in 1 / 1'], [3, 'with 4: classic'], [4, 'with 3: classic, or 3 / 4 portrait'], [9, 'with 16: widescreen'], [16, 'with 9: widescreen'], [21, 'with 9: ultra-wide']] };
  S.columnCount = { ...S.gridColumns, title: 'Columns of text', about: 'How many newspaper-style columns the text flows through.', opts: [[1, 'one'], [2, 'two (common)'], [3, 'three'], [4, 'four']] };
  /* CSS keyword values: property -> { title, about, list: [[word, label]] }. A list is "word=label|word=label". */
  const W = (props, title, about, list) => { const e = { title, about, list: list.split('|').map(x => x.split('=')) }; for (const p of props.split(' ')) WORDS[p] = e; };
  W('text-align text-align-last', 'Text alignment', 'Where the lines of text sit across their box.',
    'left=lines start at the left (the usual)|center=centred: headings, short lines|right=lines end at the right|justify=both edges straight, like a newspaper|start=where reading starts (left in English)|end=where reading ends');
  W('display', 'How it lays out', 'How the box sits among its neighbours, and how its own contents are laid out.',
    'block=its own full-width line|inline=flows inside a line of text|inline-block=in a line, but with a width and height|flex=its contents in a row (or column)|inline-flex=a flex row that sits in a line|grid=its contents in a grid|none=hidden, taking no room|contents=as if only its contents were there');
  W('position', 'Positioning', 'Whether it stays in the flow of the page or is placed by top, left, right and bottom.',
    'static=in the flow (the usual)|relative=in the flow, nudged by top and left; anchors absolute children|absolute=placed inside the nearest positioned box|fixed=placed on the screen; stays put when scrolling|sticky=in the flow, then sticks when scrolled to');
  W('cursor', 'Pointer shape', 'The shape of the mouse pointer over it, a hint about what clicking does.',
    'auto=whatever fits (the usual)|default=the plain arrow|pointer=a hand: clickable|text=a text bar: can type or select|move=arrows: can be dragged|grab=an open hand: can be dragged|not-allowed=a no sign: can\'t be used|wait=busy|help=a question mark|crosshair=a cross: aiming, drawing|none=no pointer at all');
  W('text-transform', 'Capitals', 'Changes the letters\' case on screen without changing the text itself.',
    'none=as written|uppercase=ALL CAPITALS|lowercase=all small letters|capitalize=First Letter Of Each Word');
  W('text-decoration text-decoration-line', 'Line on the text', 'A line drawn under, over or through the text. Links are underlined by default.',
    'none=no line: takes the underline off links|underline=a line under|overline=a line over|line-through=crossed out: done, removed');
  W('overflow overflow-x overflow-y', 'When it doesn\'t fit', 'What happens to contents that are too big for the box.',
    'visible=spills out (the usual)|hidden=cut off at the edge|scroll=always shows scroll bars|auto=scroll bars only when needed|clip=cut off, and can\'t be scrolled');
  W('flex-direction', 'Direction', 'Which way the items in a flex box are laid out.',
    'row=side by side, left to right (the usual)|column=stacked, top to bottom|row-reverse=side by side, right to left|column-reverse=stacked, bottom to top');
  W('flex-wrap', 'Wrapping', 'Whether items that don\'t fit on one line move on to the next.',
    'nowrap=all on one line, squeezed (the usual)|wrap=onto the next line when full|wrap-reverse=onto the line above when full');
  W('justify-content align-content place-content', 'Spread along the line', 'How items share the space along the row (or column): bunched at one end, centred, or spread out.',
    'flex-start=bunched at the start|center=bunched in the middle|flex-end=bunched at the end|space-between=spread out, ends touching the edges|space-around=spread out, half gaps at the edges|space-evenly=spread out, equal gaps everywhere|start=at the start|end=at the end|stretch=stretched to fill');
  W('align-items align-self justify-items justify-self place-items place-self', 'Line up across', 'How items line up across the row: along the top, the middle or the bottom (or stretched to the same height).',
    'stretch=stretched to the same height (the usual)|flex-start=lined up along the top|center=lined up through the middle|flex-end=lined up along the bottom|baseline=lined up by their text|start=at the start|end=at the end');
  W('object-fit', 'How a picture fits', 'How a picture or video fills a box of a different shape.',
    'fill=stretched to fit, can look squashed (the usual)|contain=all of it shows, with gaps at the sides|cover=fills the box, edges cropped|none=its own size, cropped|scale-down=its own size, or smaller to fit');
  W('white-space', 'Spaces and line breaks', 'Whether extra spaces and line breaks in the text show, and whether long lines wrap.',
    'normal=spaces squeezed, lines wrap (the usual)|nowrap=all on one line|pre=spaces and line breaks kept, no wrapping: code|pre-wrap=spaces and line breaks kept, lines wrap|pre-line=line breaks kept, spaces squeezed');
  W('font-style', 'Slant', 'Whether the letters lean.', 'normal=upright|italic=the italic letters|oblique=upright letters, slanted');
  W('visibility', 'Visibility', 'Whether it shows. Hidden things still take up their room; display: none takes the room away too.',
    'visible=shows (the usual)|hidden=invisible, room kept|collapse=hidden; table rows close up');
  W('box-sizing', 'What the width includes', 'Whether width and height include the padding and border.',
    'border-box=includes padding and border: easier to reason about|content-box=the contents only (the browser\'s default)');
  W('border-style border-top-style border-right-style border-bottom-style border-left-style outline-style', 'Line style', 'How the border line is drawn.',
    'solid=a plain line|dashed=dashes|dotted=dots|double=two thin lines|none=no line|groove=carved in|ridge=raised|inset=pressed in|outset=standing out');
  W('font-weight', 'Boldness', 'How heavy the letters are. normal is 400 and bold is 700.',
    'normal=regular weight (400)|bold=bold (700)|lighter=lighter than around it|bolder=heavier than around it');
  W('background-size', 'Background picture size', 'How a background picture fills the box.',
    'cover=fills the box, edges cropped|contain=all of it shows, may leave gaps|auto=its own size');
  W('background-repeat', 'Background tiling', 'Whether a background picture repeats to fill the box.',
    'repeat=tiled across and down|no-repeat=once only|repeat-x=tiled across|repeat-y=tiled down|space=tiled, spaced evenly|round=tiled, stretched to fit');
  W('list-style-type', 'Bullet style', 'The marker before each list item.',
    'disc=filled dots|circle=hollow dots|square=small squares|decimal=1, 2, 3|lower-alpha=a, b, c|upper-roman=I, II, III|none=no markers');
  W('vertical-align', 'Vertical alignment', 'How an inline thing or a table cell lines up up-and-down.',
    'baseline=on the text\'s line (the usual)|middle=through the middle|top=along the top|bottom=along the bottom|text-top=with the tops of the letters|sub=lowered|super=raised');
  W('float', 'Float', 'Pushes it to one side so text wraps round it. Flex and grid are usually easier for layout.', 'none=in the flow (the usual)|left=to the left, text wraps round|right=to the right, text wraps round');
  W('user-select', 'Selecting text', 'Whether the text can be selected with the mouse.', 'auto=the usual|none=can\'t be selected: buttons, game screens|text=can be selected|all=one click selects all of it');
  W('pointer-events', 'Clicks', 'Whether it reacts to the mouse, or lets clicks pass through to what\'s behind.', 'auto=reacts (the usual)|none=clicks pass through');
  W('scroll-behavior', 'Scrolling', 'How the page moves when a link jumps to a place on it.', 'auto=jumps straight there|smooth=glides there');
  W('text-overflow', 'Cut-off text', 'How text that doesn\'t fit is cut off (with overflow: hidden and white-space: nowrap).', 'clip=cut off at the edge|ellipsis=ends with …');
  W('transition-timing-function animation-timing-function', 'How it speeds up and slows down', 'The pace of the change over its time.',
    'ease=starts quickly, settles gently (the usual)|linear=one steady pace|ease-in=starts slow, ends fast|ease-out=starts fast, ends slow: things arriving|ease-in-out=slow at both ends|step-start=jumps at the start|step-end=jumps at the end');
  const BORDER_WORDS = WORDS['border-style'], TIMING_WORDS = WORDS['transition-timing-function'];

  /* ---- drawing: a drawing area's size, shapes at positions ---- */
  /* Which group of a sentence pattern the value is in (the pattern needs the d flag), and whether it is all of it. */
  function slot(c, re) {
    const m = re.exec(c.t);
    if (!m || !m.indices) return null;
    for (let g = 1; g < m.indices.length; g++) {
      const p = m.indices[g];
      if (p && p[0] <= c.s0 && c.e0 <= p[1]) return { g, exact: c.t.slice(p[0], p[1]).trim() === c.t.slice(c.s0, c.e0) };
    }
    return null;
  }
  /* A value that is only part of a sum for something known: the plain number, saying what it works out. */
  const partOf = (c, what) => ({ ...fallback(c), title: 'A number', about: `Part of the working-out for ${what}.` });

  S.canvasW = { title: 'Width of the drawing area', step: 1, min: 1,
    about: 'How many pixels across the drawing area has to draw on. Styling can still stretch it on the page. Width comes first, then height: 480 by 270 is a common widescreen (16:9) size.',
    opts: [[320, 'small: 16:9 with 180'], [480, 'a common game size: 16:9 with 270'], [640, '16:9 with 360, or 4:3 with 480'], [800, '4:3 with 600'], [960, '16:9 with 540'], [1280, 'HD: 16:9 with 720'], [1920, 'full HD: 16:9 with 1080']] };
  S.canvasH = (w) => ({ title: 'Height of the drawing area', step: 1, min: 1,
    about: 'How many pixels down the drawing area has to draw on. Height comes second: with a width of 480, 270 makes a widescreen (16:9) shape.',
    opts: w > 0 ? [[w * 9 / 16, `widescreen (16:9) with ${w} across`], [w * 2 / 3, 'photo shape (3:2)'], [w * 3 / 4, 'classic screen (4:3)'], [w, 'square'], [w * 16 / 9, 'tall, like a phone (9:16)']]
      .map(([n, l]) => [Math.round(n), l]).filter((o, i, a) => a.findIndex(x => x[0] === o[0]) === i)
      : [[180, ''], [270, 'with 480: widescreen'], [360, 'with 640: widescreen'], [480, 'with 640: classic'], [540, 'with 960: widescreen'], [600, 'with 800: classic'], [720, 'with 1280: HD']] });
  const XS = [[0, 'the left edge'], [10, 'close to the edge'], [20, ''], [50, ''], [100, ''], [160, 'a third of the way, if it\'s 480 wide'], [240, 'the middle, if it\'s 480 wide'], [400, '']];
  const YS = [[0, 'the top edge'], [10, 'close to the edge'], [20, ''], [50, ''], [90, 'a third of the way, if it\'s 270 tall'], [135, 'the middle, if it\'s 270 tall'], [200, ''], [250, 'near the bottom, if it\'s 270 tall']];
  S.x = (title, about) => ({ title: title || 'Across (x)', step: 1, opts: XS, about: about || 'How far from the left edge of the drawing area, in pixels: x counts across from the left.' });
  S.y = (title, about) => ({ title: title || 'Down (y)', step: 1, opts: YS, about: about || 'How far down from the top of the drawing area, in pixels: y counts down from the top, not up as in maths.' });
  S.boxW = { title: 'Width of the rectangle', step: 1, min: 0, about: 'How wide the rectangle is, in pixels, going right from its x.',
    opts: [[2, 'a hairline'], [4, 'a thin bar'], [10, 'a small block'], [20, 'a block'], [40, 'a brick'], [64, 'a big block'], [100, ''], [200, 'a wide bar']] };
  S.boxH = { title: 'Height of the rectangle', step: 1, min: 0, about: 'How tall the rectangle is, in pixels, going down from its y.',
    opts: [[2, 'a hairline'], [4, 'a thin bar'], [10, 'a small block'], [20, 'a block'], [40, 'a brick'], [64, 'a big block'], [100, ''], [200, 'a tall bar']] };
  S.circleR = { title: 'Radius', step: 1, min: 0, about: 'How far the edge of the circle is from its centre, in pixels; it is half the circle\'s width.',
    opts: [[2, 'a speck'], [4, 'a dot'], [6, 'a pellet'], [10, 'a ball'], [16, 'a big ball'], [24, 'a coin'], [32, 'a sun'], [50, 'a planet']] };
  S.drawText = { title: 'Text size', step: 1, min: 1, about: 'How tall the letters are drawn, in pixels. 16 is ordinary text; scores and titles are often 24 to 48.',
    opts: [[10, 'tiny'], [12, 'small print'], [14, 'small'], [16, 'ordinary text (the usual)'], [20, 'a little bigger'], [24, 'a score or label'], [32, 'a heading'], [48, 'a title'], [64, 'a big title']] };
  S.lineWidth = { title: 'Line thickness', step: 1, min: 0, about: 'How thick the line is drawn, in pixels.',
    opts: [[1, 'a fine line'], [2, 'clear (common)'], [3, 'bold'], [4, 'thick'], [6, 'very thick'], [10, 'a stripe']] };

  // HTML: a drawing area's size
  rule((c) => {
    if (c.code !== 'html' || c.v.kind !== 'number') return null;
    const s = slot(c, /^\s*add\s+(?:a\s+|an\s+)?(?:drawing area|canvas)(.*?)\s+(\d+)\s*(?:by|x)\s*(\d+)(?:\s+in groups?\s+.+)?\s*$/id);
    if (s && s.g === 2) return S.canvasW;
    if (s && s.g === 3) return S.canvasH(+(c.t.match(/(\d+)\s*(?:by|x)\s*\d+\b/i) || [])[1]);
    return null;
  });
  // JS: drawing sentences
  rule((c) => {
    if (c.v.kind !== 'number' || c.code !== 'js') return null;
    let s;
    if ((s = slot(c, /^\s*draw (?:a |an )?(?:rectangle|box|square|block)\s+at\s+(.+?)\s*,\s*(.+?)\s+(?:sized|size|of size)\s+(.+?)\s+by\s+(.+?)\s+in\s+(.+?)\s+on\s+(.+)$/id)) && s.g <= 4) {
      const sp = [S.x('Across (x)', 'How far the rectangle\'s left edge is from the left of the drawing area, in pixels.'), S.y('Down (y)', 'How far the rectangle\'s top edge is from the top of the drawing area, in pixels: y counts down.'), S.boxW, S.boxH][s.g - 1];
      return s.exact ? sp : partOf(c, ['the x position', 'the y position', 'the width', 'the height'][s.g - 1]);
    }
    if ((s = slot(c, /^\s*draw (?:a )?(?:circle|dot|ball)\s+at\s+(.+?)\s*,\s*(.+?)\s+(?:with (?:a )?)?radius\s+(.+?)\s+in\s+(.+?)\s+on\s+(.+)$/id)) && s.g <= 3) {
      const sp = [S.x('Centre across (x)', 'How far the circle\'s centre is from the left of the drawing area, in pixels.'), S.y('Centre down (y)', 'How far the circle\'s centre is from the top of the drawing area, in pixels: y counts down.'), S.circleR][s.g - 1];
      return s.exact ? sp : partOf(c, ['the centre\'s x', 'the centre\'s y', 'the radius'][s.g - 1]);
    }
    if ((s = slot(c, /^\s*draw (?:the )?text\s+(.+?)\s+at\s+(.+?)\s*,\s*(.+?)(?:\s+(?:in )?size\s+(\S+))?\s+in\s+(.+?)\s+on\s+(.+)$/id)) && s.g >= 2 && s.g <= 4) {
      const sp = [S.x('Across (x)', 'Where the text starts, from the left of the drawing area, in pixels.'), S.y('Down (y)', 'Where the line the letters sit on is, from the top of the drawing area, in pixels. Text at y 0 would be above the top, out of sight.'), S.drawText][s.g - 2];
      return s.exact ? sp : partOf(c, ['the x position', 'the y position', 'the text size'][s.g - 2]);
    }
    if ((s = slot(c, /^\s*draw (?:a )?line\s+from\s+(.+?)\s*,\s*(.+?)\s+to\s+(.+?)\s*,\s*(.+?)\s+in\s+(.+?)\s+on\s+(.+)$/id)) && s.g <= 4) {
      const sp = [S.x('Start across (x)'), S.y('Start down (y)'), S.x('End across (x)'), S.y('End down (y)')][s.g - 1];
      return s.exact ? sp : partOf(c, ['where the line starts across', 'where the line starts down', 'where the line ends across', 'where the line ends down'][s.g - 1]);
    }
    return null;
  });
  // drawing calls in code: pen.fillRect(x, y, w, h), arc, fillText; tkinter's create_rectangle, create_oval, create_line, create_text
  rule((c) => {
    const call = c.call;
    if (c.v.kind !== 'number' || !call || c.css || c.kw) return null;
    const f = call.name, a = call.arg, whole = /^\s*$/.test(c.segAfter) && (/^\s*$/.test(c.seg) || /\s(?:with|using)\s+$/i.test(c.seg));
    let sp = null;
    if (/^(?:fillRect|strokeRect|clearRect|rect)$/.test(f) && a < 4) sp = [S.x(), S.y(), S.boxW, S.boxH][a];
    else if (/^(?:arc|ellipse)$/.test(f) && a < 3) sp = [S.x('Centre across (x)'), S.y('Centre down (y)'), S.circleR][a];
    else if (/^(?:fillText|strokeText)$/.test(f) && a >= 1 && a <= 2) sp = [S.x(), S.y()][a - 1];
    else if (/^(?:moveTo|lineTo)$/.test(f) && a < 2) sp = [S.x(), S.y()][a];
    else if (/^(?:create_rectangle|create_oval)$/.test(f) && a < 4 && !call.kw) {
      const shape = f === 'create_oval' ? ' of the box the oval fits in' : '';
      sp = [S.x('Left edge (x1)', `The left edge${shape}, in pixels from the left of the canvas.`), S.y('Top edge (y1)', `The top edge${shape}, in pixels down from the top of the canvas.`),
        S.x('Right edge (x2)', `The right edge${shape}, in pixels from the left of the canvas (not a width).`), S.y('Bottom edge (y2)', `The bottom edge${shape}, in pixels down from the top of the canvas (not a height).`)][a];
    } else if (/^create_(?:line|polygon)$/.test(f) && !call.kw) sp = a % 2 ? S.y(`Point ${(a >> 1) + 1} down (y)`) : S.x(`Point ${(a >> 1) + 1} across (x)`);
    else if (/^create_(?:text|image|window)$/.test(f) && a < 2 && !call.kw) sp = [S.x('Across (x)', 'Where the middle of it goes, in pixels from the left of the canvas (anchor="nw" makes it the top-left corner instead).'), S.y('Down (y)', 'Where the middle of it goes, in pixels down from the top of the canvas: y counts down.')][a];
    if (!sp) return null;
    return whole ? sp : partOf(c, sp.title.toLowerCase());
  });

  /* ---- time, sound, counting ---- */
  const secStep = (c) => (decimals(numPart(c.v)) || c.n < 1 ? 0.1 : 1);
  const msStep = (c) => (c.n >= 1000 ? 100 : c.n >= 100 ? 50 : 1);
  const SECS = {
    wait: ['Seconds to wait', 'How long the program pauses before the next line, in seconds. Decimals work: 0.5 is half a second.',
      [[0.1, 'a blink'], [0.25, 'a quarter of a second'], [0.5, 'half a second'], [1, 'one second'], [2, 'a pause'], [3, 'a longer pause'], [5, 'time to read a message'], [10, ''], [60, 'a minute']]],
    after: ['Seconds before it runs', 'How long to wait before the indented lines run, once, in seconds.',
      [[0.5, 'half a second'], [1, 'one second'], [2, ''], [3, 'time to read a short message'], [5, ''], [10, ''], [30, 'half a minute'], [60, 'a minute']]],
    every: ['Seconds between runs', 'How often the indented lines run again, in seconds: 1 is once a second, 0.1 ten times a second.',
      [[0.1, 'ten times a second'], [0.5, 'twice a second'], [1, 'once a second: a clock'], [2, ''], [5, ''], [10, ''], [30, ''], [60, 'once a minute']]],
    note: ['Length of the note', 'How long the note plays, in seconds.',
      [[0.05, 'a click'], [0.1, 'a blip'], [0.2, 'a short beep (common)'], [0.3, ''], [0.5, 'a held note'], [1, 'a long note'], [2, 'a drone']]],
    any: ['Seconds', 'A time in seconds. Decimals work: 0.5 is half a second.', [[0.1, ''], [0.25, 'a quarter of a second'], [0.5, 'half a second'], [1, 'one second'], [2, ''], [5, ''], [10, ''], [60, 'a minute']]],
  };
  const MS = {
    wait: ['Milliseconds to wait', 'How long it pauses before going on, in thousandths of a second: 1000 is one second.',
      [[10, ''], [16, 'about a frame at 60 a second'], [50, 'a twentieth of a second'], [100, 'a tenth of a second'], [250, 'a quarter of a second'], [500, 'half a second: a steady blink'], [1000, 'one second'], [2000, 'two seconds']]],
    after: ['Milliseconds before it runs', 'How long to wait before it runs, in thousandths of a second: 1000 is one second.',
      [[0, 'as soon as it can'], [16, 'about a frame at 60 a second'], [100, 'a tenth of a second'], [250, 'a quarter of a second'], [500, 'half a second'], [1000, 'one second'], [2000, 'two seconds'], [5000, 'five seconds']]],
    every: ['Milliseconds between runs', 'How often it runs again, in thousandths of a second: smaller is more often, 1000 is once a second.',
      [[16, 'about 60 times a second: smooth movement'], [33, 'about 30 times a second'], [50, '20 times a second'], [100, '10 times a second'], [150, 'a steady game tick'], [250, 'four times a second'], [500, 'twice a second'], [1000, 'once a second']]],
    note: ['Length of the note', 'How long the note plays, in thousandths of a second: 1000 is one second.',
      [[50, 'a click'], [100, 'a blip'], [200, 'a short beep (common)'], [300, ''], [500, 'a held note'], [1000, 'a long note']]],
    any: ['Milliseconds', 'A time in thousandths of a second: 1000 is one second.', [[16, 'about a frame at 60 a second'], [50, ''], [100, 'a tenth of a second'], [250, 'a quarter of a second'], [500, 'half a second'], [1000, 'one second'], [2000, 'two seconds']]],
  };
  S.time = (kind, ms) => { const [title, about, opts] = (ms ? MS : SECS)[kind]; return { title, about, opts, step: ms ? msStep : secStep, min: 0 }; };
  S.pitch = { title: 'Pitch', step: 'cycle', min: 1,
    about: 'How high the note is, in hertz (vibrations a second). 440 is the A above middle C; doubling a pitch goes up an octave.',
    opts: [[220, 'A, an octave down'], [262, 'C: middle C'], [294, 'D'], [330, 'E'], [349, 'F'], [392, 'G'], [440, 'A: the tuning note'], [494, 'B'], [523, 'C, an octave above middle C'], [880, 'A, an octave up']] };
  S.times = { title: 'Times to repeat', step: 1, min: 0, about: 'How many times the indented lines run.',
    opts: [[1, 'once'], [2, 'twice'], [3, 'three: a few'], [4, 'four: the sides of a square'], [5, ''], [10, 'ten'], [12, 'a dozen'], [20, ''], [100, 'a hundred: a quick stress test']] };
  S.randomLow = { title: 'Smallest it can pick', step: 1, about: 'The smallest number the random pick can give. Both ends can come up.',
    opts: [[0, 'zero: positions in a list start here'], [1, 'one: dice, everyday counting'], [-1, ''], [10, ''], [100, '']] };
  S.randomHigh = { title: 'Biggest it can pick', step: 1, about: 'The biggest number the random pick can give, included: from 1 to 6 rolls a dice, each number as likely as the others.',
    opts: [[2, 'a coin toss, from 1'], [6, 'a dice'], [10, ''], [12, 'a twelve-sided dice'], [20, 'a twenty-sided dice'], [100, 'a percentage'], [1000, '']] };
  S.places = { title: 'Decimal places', step: 1, min: 0, about: 'How many digits to keep after the decimal point; the last one is rounded.',
    opts: [[0, 'a whole number'], [1, 'tenths: 3.1'], [2, 'hundredths: 3.14, money'], [3, 'thousandths: 3.142'], [4, ''], [6, '']] };
  S.index = (neg) => ({ title: 'Position in the list', step: 1, about: 'Which item, counting from 0: item 0 is the first.' + (neg ? ' Negative positions count from the end: -1 is the last.' : ''),
    opts: [[0, 'the first item'], [1, 'the second'], [2, 'the third'], ...(neg ? [[-1, 'the last item'], [-2, 'the one before last']] : [[3, 'the fourth'], [4, 'the fifth']])] });
  S.fps = { title: 'Frames a second', step: 1, min: 1, about: 'How many times a second the game redraws, at most. 60 is smooth; 30 is fine for slower games.',
    opts: [[12, 'jerky, like old cartoons'], [24, 'film'], [30, 'smooth enough'], [60, 'smooth (the usual)'], [120, 'very smooth, on fast screens']] };
  S.arraySize = { title: 'How many items it holds', step: 1, min: 1, about: 'The list\'s size, fixed when it is made: it holds exactly this many items, numbered from 0.',
    opts: [[3, ''], [5, ''], [8, ''], [10, ''], [16, ''], [32, ''], [100, '']] };
  const changeBy = (name, how, c) => {
    const k = nameKey(name);
    if (decimals(numPart(c.v))) return { title: { up: `How much ${name} goes up by`, down: `How much ${name} goes down by`, times: `What ${name} is multiplied by`, divide: `What ${name} is divided by` }[how], about: `${name} changes by this much each time this line runs.`, opts: spread };
    const title = { up: `How much ${name} goes up by`, down: `How much ${name} goes down by`, times: `What ${name} is multiplied by`, divide: `What ${name} is divided by` }[how];
    if (how === 'times' || how === 'divide') return { title, step: 0.1, about: how === 'times' ? `${name} becomes this many times as big: 2 doubles it, 0.5 halves it.` : `${name} is split into this many parts: 2 halves it.`,
      opts: [[0.5, how === 'times' ? 'halve it' : 'double it'], [1.1, how === 'times' ? 'ten per cent more' : 'a little less'], [2, how === 'times' ? 'double it' : 'halve it'], [3, ''], [10, '']] };
    if (/speed|velocity|^v?[xy]$|^d[xy]$|^(?:p[xy]|x|y|pos)/.test(k)) return { title, step: 1, about: `How many pixels ${name} changes by each time. Done every frame, 1 or 2 is gentle and 10 is fast.`, opts: [[1, 'gentle'], [2, 'steady'], [3, ''], [5, 'quick'], [8, 'fast'], [10, 'very fast'], [20, 'a jump']] };
    return { title, about: `${name} changes by this much each time this line runs.`, opts: [[1, 'one at a time (common)'], [2, ''], [5, ''], [10, ''], [100, '']] };
  };

  // timing, sound, repeats, random picks, rounding, counting, changing by: in sentences and in code
  rule((c) => {
    if (c.v.kind !== 'number' || c.css) return null;
    const b = c.before.toLowerCase(), a = c.after.toLowerCase(), call = c.call, f = call ? call.name : '', u = c.unit;
    const verb = /\b(?:wait|pause|sleep)\s+(?:for\s+)?$/.test(b) ? 'wait' : /^\s*after\s+$/.test(b) ? 'after' : /^\s*every\s+$/.test(b) ? 'every'
      : /\bfor\s+$/.test(b) && /\b(?:note|tone|sound|beep)\b/.test(b) ? 'note' : 'any';
    const time = (kind, ms) => { const s = S.time(kind, ms); return c.lang === 'arduino' && kind === 'wait' ? { ...s, about: s.about + ' The board does nothing else while it waits.' } : s; };
    if (/^\s*(?:seconds?|secs?)\b/.test(a) || (u === 's' && !c.css)) return time(verb, false);
    if (/^\s*(?:milliseconds?|ms)\b/.test(a) || u === 'ms') return time(verb, true);
    if (call && !call.kw && /^(?:sleep)$/.test(f) && call.arg === 0) return time('wait', false);
    if (call && /^(?:delay)$/.test(f) && call.arg === 0) return time('wait', true);
    if (call && /^(?:setTimeout|setInterval)$/.test(f) && call.arg === 1) return S.time(f === 'setTimeout' ? 'after' : 'every', true);
    if (call && f === 'after' && call.arg === 0) return S.time('after', true);
    if (call && f === 'tick' && call.arg === 0) return S.fps;
    if (/\bplay (?:a |the )?(?:note|tone|sound)(?: of)?\s+$/.test(b) || /\bfrequency(?:\.value)?\s*=\s*$/.test(b) || (call && f === 'tone' && call.arg === 1)) return S.pitch;
    if (call && f === 'tone' && call.arg === 2) return S.time('note', true);
    if (/^\s*(?:repeat|do this|do it|loop)\s+$/.test(b) && /^\s*times?\b/.test(a)) return S.times;
    if (/\bfor\s*\(.*;\s*[\w$]+\s*<=?\s*$/.test(b)) return { ...S.times, title: 'Times round the loop', about: 'The loop runs while the counter is below this number; starting from 0, that is this many times.' };
    if (call && f === 'range' && !/,/.test(c.t.slice(c.e0).split(')')[0]) && call.arg === 0) return { ...S.times, title: 'How many to count', about: 'range counts from 0 up to one less than this number: range(10) gives 0 to 9, ten numbers.' };
    if (call && f === 'range' && call.arg < 2) return call.arg ? { ...S.randomHigh, title: 'Counting stops before', about: 'range stops one short of this number: range(1, 11) gives 1 to 10.', opts: [[5, ''], [10, ''], [11, 'with 1: one to ten'], [20, ''], [100, ''], [101, 'with 1: one to a hundred']] } : { ...S.randomLow, title: 'Counting starts at', about: 'The first number range gives.' };
    if (/\brandom (?:whole )?number (?:from|between)\s+$/.test(b)) return S.randomLow;
    if (/\brandom (?:whole )?number (?:from|between)\s+\S+\s+(?:to|and)\s+$/.test(b)) return S.randomHigh;
    if (call && /^(?:randint|randrange|uniform|random)$/.test(f) && call.arg < 2 && (f !== 'random' || c.code === 'arduino' || c.code === 'cpp')) {
      if (call.arg === 0 && /,/.test(c.t.slice(c.e0).split(')')[0])) return S.randomLow;
      const excl = f === 'randrange' || f === 'random';
      return { ...S.randomHigh, about: excl ? 'The pick stops one short of this number: random(1, 7) rolls a dice, 1 to 6.' : S.randomHigh.about,
        opts: excl ? [[2, 'with 0: a coin toss'], [7, 'with 1: a dice'], [11, 'with 1: one to ten'], [101, 'with 1: one to a hundred']] : S.randomHigh.opts };
    }
    if (/\brounded to\s+$/.test(b) && /^\s*(?:decimal\s+)?places?\b/.test(a) || (call && f === 'round' && call.arg === 1) || (call && f === 'toFixed' && call.arg === 0)) return S.places;
    if (/^\s*(?:count(?: down| up)?|for)(?:\s+.+?)?\s+from\s+$/.test(b)) return { ...S.randomLow, title: 'Counting starts at', about: 'The first number the count gives.' };
    if (/^\s*(?:count(?: down| up)?|for)(?:\s+.+?)?\s+from\s+.+?\s+(?:down\s+)?to\s+$/.test(b)) return { ...S.times, min: undefined, title: 'Counting goes up to', about: 'The last number the count gives: this number is included.' };
    if (/\s(?:in steps of|stepping by|step|by)\s+$/.test(b) && /^\s*(?:count|for)\b.*\sfrom\s/.test(b)) return { title: 'Counting in steps of', step: 1, about: 'How much the count goes up by each time round.', opts: [[1, 'every number'], [2, 'every other number'], [5, 'fives'], [10, 'tens']] };
    let m;
    if ((m = b.match(/^\s*(?:increase|raise|increment|bump up|go up|move)\s+(.+?)\s+by\s+$/))) return c.whole ? changeBy(c.before.match(/^\s*\S+(?:\s+up)?\s+(.+?)\s+by\s+$/i)[1], 'up', c) : null;
    if ((m = b.match(/^\s*(?:decrease|lower|reduce|decrement|go down)\s+(.+?)\s+by\s+$/))) return c.whole ? changeBy(c.before.match(/^\s*\S+(?:\s+down)?\s+(.+?)\s+by\s+$/i)[1], 'down', c) : null;
    if ((m = c.before.match(/^\s*(multiply|divide)\s+(.+?)\s+by\s+$/i))) return c.whole ? changeBy(m[2], m[1].toLowerCase() === 'multiply' ? 'times' : 'divide', c) : null;
    if ((m = c.before.match(/^\s*([A-Za-z_$][\w$.]*)\s*([+\-*/])=\s*$/)) && c.whole) return changeBy(m[1], { '+': 'up', '-': 'down', '*': 'times', '/': 'divide' }[m[2]], c);
    if (c.t[c.s0 - 1] === '[' && c.t[c.e0] === ']' && /[\w$\])]$/.test(c.t.slice(0, c.s0 - 1))) {
      if (/\b(?:int|float|double|char|bool|long|byte|String|auto|unsigned|short)\s+[\w$]+$/.test(c.t.slice(0, c.s0 - 1))) return S.arraySize;
      return S.index(c.code === 'python');
    }
    if (/\bitem\s+$/.test(b) && /^\s+of\b/.test(a)) return S.index(c.code === 'python');
    return null;
  });

  /* ---- Python windows (tkinter, pygame), and what a name suggests ---- */
  S.tkFont = { title: 'Text size', step: 1, min: 1, about: 'How big the letters are, in points (about 1.3 pixels each). 10 to 12 is ordinary text in a window.',
    opts: [[8, 'small print'], [10, 'small'], [12, 'ordinary text (common)'], [14, 'comfortable to read'], [16, 'a label that stands out'], [20, 'a heading'], [24, 'a big heading'], [32, 'a title'], [48, 'a big title']] };
  S.winW = { title: 'Width', step: 1, min: 1, about: 'How many pixels across the window or canvas is.',
    opts: [[200, ''], [300, ''], [400, 'a small window'], [480, ''], [600, ''], [640, 'a classic game window'], [800, 'a roomy window'], [1024, ''], [1280, 'HD width']] };
  S.winH = { title: 'Height', step: 1, min: 1, about: 'How many pixels down the window or canvas is.',
    opts: [[150, ''], [200, ''], [300, 'a small window'], [360, ''], [400, ''], [480, 'a classic game window'], [600, 'a roomy window'], [720, 'HD height']] };
  S.charW = { title: 'Width, in letters', step: 1, min: 0, about: 'For buttons, labels and text boxes, tkinter measures width in letters (average characters), not pixels.',
    opts: [[5, 'a short word'], [10, 'a button'], [15, ''], [20, 'a name'], [30, 'a sentence'], [40, 'a long line'], [60, 'a full line']] };
  S.tkPad = (k) => ({ title: k === 'pady' ? 'Space above and below' : 'Space at the sides', step: 1, min: 0, about: 'Extra room round the widget, in pixels.',
    opts: [[0, 'none'], [2, 'a sliver'], [4, ''], [5, ''], [8, 'comfortable'], [10, ''], [16, 'roomy'], [20, '']] });
  S.thin = { title: 'Border thickness', step: 1, min: 0, about: 'How thick the edge line is, in pixels. 0 removes it.', opts: [[0, 'none'], [1, 'a fine line'], [2, 'clear'], [3, 'bold'], [5, 'thick']] };
  // what a value is for, from the name it is given: set lives to 3, START_SPEED = 150
  const NAME_HINTS = [
    [/lives?$/, (c) => ({ title: 'Lives', step: 1, min: 0, about: 'How many chances the player has.', opts: [[1, 'one chance: hard'], [2, ''], [3, 'the classic'], [5, 'forgiving'], [10, 'very forgiving']] })],
    [/(?:^|[^a-z])?(?:health|hp)$/, (c) => ({ title: 'Health', step: 1, min: 0, about: 'How much damage can be taken before it is over.', opts: [[3, 'three hits'], [5, ''], [10, ''], [20, ''], [100, 'as a percentage']] })],
    [/score|points/, (c) => ({ title: 'Score', step: 1, about: 'The score here. Games usually start it at 0 and add to it.', opts: [[0, 'a fresh start (the usual)'], [1, ''], [10, ''], [100, ''], [1000, '']] })],
    [/gravity/, (c) => ({ title: 'Gravity', step: 0.1, min: 0, about: 'How much faster things fall each frame, in pixels per frame. Small numbers matter here.', opts: [[0.1, 'floaty: the moon'], [0.2, 'light'], [0.3, ''], [0.5, 'the usual'], [0.8, 'heavy'], [1, 'very heavy']] })],
    [/jump/, (c) => ({ title: 'Jump strength', step: 1, min: 0, about: 'How fast something leaves the ground when it jumps, in pixels per frame. With gravity 0.5, 10 jumps about 100 pixels high.', opts: [[5, 'a hop'], [8, 'a jump'], [10, 'the usual'], [12, 'a high jump'], [15, 'a leap']] })],
    [/speed|velocity/, (c) => (c.n >= 30 && !decimals(numPart(c.v))
      ? { title: 'Speed: time per step', step: 10, min: 1, about: 'A speed this size is usually the milliseconds between steps, so a smaller number is faster.', opts: [[50, 'very fast'], [60, 'fast'], [80, ''], [100, 'brisk'], [120, ''], [150, 'steady'], [200, 'relaxed'], [300, 'slow']] }
      : { title: 'Speed', min: 0, about: 'How many pixels it moves each frame (about 60 frames a second): 1 is slow, 10 is fast.', opts: [[0.5, 'creeping'], [1, 'slow'], [2, 'gentle'], [3, 'steady'], [5, 'quick'], [8, 'fast'], [10, 'very fast'], [15, 'a blur']] })],
    [/^(?:tick(?:ms|time|length)?|pause|wait(?:time|ms)?|frametime)$|delay(?:ms)?$|interval(?:ms)?$/, (c) => S.time(/tick|interval|timer/.test(nameKey(c.setName)) ? 'every' : 'wait', c.n >= 10 && !decimals(numPart(c.v)))],
    [/^(?:fps|framerate|framespersecond)$/, () => S.fps],
    [/(?:^|[^a-z])(?:cell|tile|square|block|grid)(?:size)?$|^(?:cell|tile|block)/, (c) => ({ title: 'Size of each square', step: 1, min: 1, about: 'How many pixels across each square (or tile) of the grid is.', opts: [[8, 'tiny'], [16, 'small: pixel art'], [20, ''], [24, 'comfortable'], [32, 'big: clear to see'], [40, ''], [48, 'chunky'], [64, 'huge']] })],
    [/(?<!ar)rows$/, (c) => ({ title: 'Rows', step: 1, min: 1, about: 'How many rows down.', opts: [[3, ''], [4, ''], [5, ''], [8, ''], [10, ''], [12, ''], [15, ''], [20, '']] })],
    [/(?:columns|cols)$/, (c) => ({ title: 'Columns', step: 1, min: 1, about: 'How many columns across.', opts: [[3, ''], [4, ''], [5, ''], [8, ''], [10, ''], [12, ''], [16, ''], [20, '']] })],
    [/^(?:width|w|(?:window|screen|canvas|game|stage|board)width)$/, () => S.winW], [/^(?:height|h|(?:window|screen|canvas|game|stage|board)height)$/, () => S.winH],
    [/(?:width|height|size)$/, (c) => ({ title: /height$/.test(nameKey(c.setName)) ? 'Height' : /width$/.test(nameKey(c.setName)) ? 'Width' : 'Size', step: 1, min: 0, about: 'How big it is, in pixels.',
      opts: [[4, ''], [8, ''], [12, ''], [16, ''], [24, ''], [32, ''], [48, ''], [64, ''], [100, '']] })],
    [/radius$|^r$/, () => S.circleR],
    [/(?:gap|spacing|margin|padding)$/, () => ({ ...S.gap, len: false })],
    [/level$/, () => ({ title: 'Level', step: 1, min: 0, about: 'Which level to start on. Most games start at 1.', opts: [[0, 'a practice level'], [1, 'the first (the usual)'], [2, ''], [3, ''], [5, ''], [10, '']] })],
    [/volume$/, () => ({ title: 'Volume', step: 0.1, min: 0, max: 1, about: 'How loud, from 0 (silent) to 1 (full).', opts: [[0, 'silent'], [0.25, 'quiet'], [0.5, 'half'], [0.75, ''], [1, 'full']] })],
    [/(?:angle|rotation|heading|direction)$/, () => ({ ...S.turn, units: undefined, about: 'An angle in degrees: 90 is a quarter turn, 180 a half, 360 all the way round.' })],
    [/(?:font|text)size$/, () => S.drawText],
  ];

  // Python and JS: tkinter and pygame arguments, then names
  rule((c) => {
    if (c.v.kind !== 'number' || c.css) return null;
    const call = c.call, f = call ? call.name : '', kw = (c.kw || '').toLowerCase();
    if (call && call.fn === '' && call.arg === 1 && /\(\s*["'`]\u0001*["'`]\s*,\s*$/.test(c.before)) return S.tkFont;   // ("Arial", 16)
    if (kw === 'size' && /\bfont\b/i.test(c.before)) return S.tkFont;
    if (/set_mode\s*\(\s*\(\s*(?:[\d.]+\s*,\s*)?$/.test(c.before)) return call.arg ? S.winH : S.winW;
    if (kw === 'width' || kw === 'height') {
      if (/^create_/.test(f) && kw === 'width') return S.lineWidth;
      if (/^(?:Label|Button|Entry|Text|Listbox|Spinbox|Checkbutton|Radiobutton|Scale|Message|OptionMenu|Combobox)$/.test(f)) return kw === 'width' ? S.charW : { ...S.charW, title: 'Height, in lines', about: 'For text boxes and lists, tkinter measures height in lines of text, not pixels.', opts: [[1, 'one line'], [3, ''], [5, ''], [10, ''], [20, '']] };
      return kw === 'width' ? { ...S.winW, title: f === 'Canvas' ? 'Width of the canvas' : 'Width' } : { ...S.winH, title: f === 'Canvas' ? 'Height of the canvas' : 'Height' };
    }
    if (kw === 'padx' || kw === 'pady' || kw === 'ipadx' || kw === 'ipady') return S.tkPad(kw.replace(/^i/, ''));
    if (/^(?:borderwidth|bd|highlightthickness|outlinewidth|linewidth|thickness)$/.test(kw)) return S.thin;
    if (/^(?:linewidth)$/i.test(nameKey((c.setName || '').split('.').pop())) && c.whole) return S.lineWidth;
    const name = c.setName && c.whole ? c.setName : null;
    if (name) { const k = nameKey(name.split('.').pop()); for (const [re, make] of NAME_HINTS) if (re.test(k)) return make(c); }
    return null;
  });

  /* ---- Arduino ---- */
  const UNO = 'On an Uno, 0 to 13 are digital pins (0 and 1 also carry the serial monitor), 13 has the built-in light, and the pins marked ~ (3, 5, 6, 9, 10, 11) can dim. A0 to A5 read sensors.';
  S.pin = { title: 'Pin', step: 1, min: 0, max: 53, about: 'Which pin on the board, by the number printed beside it. ' + UNO,
    opts: [[2, 'a button; can also wake the board (interrupt)'], [3, '~ can dim; interrupt'], [4, ''], [5, '~ can dim'], [6, '~ can dim'], [7, ''], [8, 'a buzzer, often'], [9, '~ can dim: LEDs, servos'], [10, '~ can dim'], [11, '~ can dim'], [12, ''], [13, 'the built-in light']] };
  S.pwmPin = { ...S.pin, title: 'Pin (one that can dim)', about: 'Which pin to dim. Only the pins marked ~ can: on an Uno, 3, 5, 6, 9, 10 and 11.',
    opts: [[3, ''], [5, ''], [6, ''], [9, 'LEDs, servos (common)'], [10, ''], [11, '']] };
  S.analogPin = { title: 'Analog pin', about: 'A pin that measures a voltage as a number from 0 to 1023: for knobs, light sensors and the like.',
    list: [['A0', 'the first: sensors, knobs'], ['A1', ''], ['A2', ''], ['A3', ''], ['A4', 'also SDA, for I2C parts'], ['A5', 'also SCL, for I2C parts']] };
  S.brightness = { title: 'Brightness', step: 5, min: 0, max: 255,
    about: 'How bright (or fast, for a motor), from 0 (off) to 255 (full). The pin flickers on and off very fast to do it, so only pins marked ~ can.',
    opts: [[0, 'off'], [16, 'a glimmer'], [64, 'a quarter'], [128, 'half'], [192, 'three quarters'], [255, 'full']] };
  S.baud = { title: 'Serial speed', step: 'cycle', min: 300,
    about: 'How fast the board and the computer talk, in bits a second. The serial monitor has to be set to the same number, or it shows gibberish.',
    opts: [[300, 'very slow'], [9600, 'the classic default'], [19200, ''], [38400, ''], [57600, ''], [115200, 'fast: lots of messages']] };
  S.analog = { title: 'Analog reading', step: 10, min: 0, max: 1023,
    about: 'A reading from an analog pin goes from 0 (0 volts) to 1023 (5 volts, or 3.3 on some boards). Halfway, 512, is about 2.5 volts.',
    opts: [[0, 'nothing: 0 volts'], [100, 'low'], [256, 'a quarter'], [512, 'halfway'], [768, 'three quarters'], [900, 'high'], [1023, 'full']] };
  S.mapEnd = (k) => ({ title: ['Range in: from', 'Range in: to', 'Range out: from', 'Range out: to'][k], step: 1,
    about: 'map turns a number from one range into another: map(reading, 0, 1023, 0, 255) turns a sensor reading into a brightness.',
    opts: [[0, 'zero'], [100, 'a percentage'], [180, 'a servo angle'], [255, 'the top of a brightness'], [1023, 'the top of an analog reading']] });
  S.servo = { title: 'Servo angle', step: 1, min: 0, max: 180, about: 'Where the servo turns to, in degrees from 0 to 180.',
    opts: [[0, 'all the way one way'], [45, ''], [90, 'the middle'], [135, ''], [180, 'all the way the other way']] };

  // Arduino comes before the other code rules, so pin names and brightness win over the general hints
  RULES.unshift((c) => {
    if (c.lang !== 'arduino') return null;
    if (c.v.kind === 'word') return /^A\d$/.test(c.v.text) ? S.analogPin : null;
    if (c.v.kind !== 'number') return null;
    const b = c.before.toLowerCase(), a = c.after.toLowerCase(), call = c.call, f = call ? call.name : '';
    const dims = /\b(?:brightness|level|power) of\s+(?:pin\s+)?$|^\s*dim\s+(?:pin\s+)?$|^\s*write\s+.+?\s+to\s+pin\s+$/.test(b);
    if (/\bpin\s+$/.test(b) || /^\s*(?:make|set)\s+$/.test(b) && /^\s+(?:an?|as)\s+(?:output|input)\b/.test(a) || dims) return dims || /^\s*write\s/.test(b) ? S.pwmPin : S.pin;
    if (call && /^(?:pinMode|digitalWrite|digitalRead|analogRead|tone|noTone|digitalPinToInterrupt|attach)$/.test(f) && call.arg === 0) return S.pin;
    if (call && f === 'analogWrite') return call.arg ? S.brightness : S.pwmPin;
    if (/\b(?:brightness|level|power) of\s+.+?\s+to\s+$|^\s*dim\s+.+?\s+to\s+$/.test(b) || /^\s*write\s+$/.test(b) && /^\s+to\s+pin\b/.test(a)) return S.brightness;
    if (/\bserial monitor at\s+$|talking to the computer at\s+$/.test(b) || (call && f === 'begin' && /serial/i.test(call.fn))) return S.baud;
    if (call && f === 'map' && call.arg >= 1) return S.mapEnd(call.arg - 1);
    if (call && f === 'write' && /servo|motor|arm/i.test(call.fn)) return S.servo;
    if (/\b(?:reading|level) (?:of|on) pin\s+\S+\s+(?:is\s+)?[a-z ]*$/.test(b) || /analogread\s*\([^)]*\)\s*[<>=!]=?\s*$/.test(b)
      || /\b(?:reading|level|sensor|light|pot|knob|moisture|analog|value)\w*\s+(?:is\s+)?(?:more|less|greater|smaller|bigger|higher|lower|at least|at most|above|below|over|under)\b[a-z ]*$/.test(b)) return S.analog;
    const k = nameKey((c.setName && c.whole ? c.setName : '').split('.').pop());
    if (/pin$|^(?:led|button|buzzer|speaker|sensor|motor|servo|relay|switch|knob|pot)/.test(k)) return S.pin;
    if (/brightness|duty|pwm/.test(k)) return S.brightness;
    if (/baud/.test(k)) return S.baud;
    if (/threshold|limit/.test(k)) return S.analog;
    return null;
  });

  const plainProp = (p) => p.replace(/^-+/, '').replace(/-/g, ' ').replace(/^./, ch => ch.toUpperCase());

  // CSS: everything else with a number
  rule((c) => {
    if (!c.css || c.v.kind !== 'number') return null;
    const p = c.prop || '', w = c.pre, call = c.call, fn = call ? call.name.toLowerCase() : '';
    if (/^\d+%\s*$/.test(c.v.text + ' ') && /^\s*(?:see-through|transparent)\b/i.test(c.after)) return /\bbackground/i.test(c.before) ? S.bgSeeThrough : S.seeThrough;
    if (/\bwith\s+$/.test(w) && /^\s*(?:intensity|strength)\b/i.test(c.after)) return S.shadowStrength;
    if (/^(?:rgba?)$/.test(fn)) return call.arg < 3 ? S.channel(['Red', 'Green', 'Blue'][call.arg]) : S.alpha;
    if (/^(?:hsla?)$/.test(fn)) return [S.hue, S.saturation, S.lightness, S.alpha][call.arg] || null;
    if (fn === 'repeat' && call.arg === 0 || /^in a grid of\s+$/.test(w)) return S.gridColumns;
    if (/gradient$/.test(fn) && call.arg === 0 && /deg|turn/.test(c.unit)) return S.gradient;
    if (fn === 'minmax' && call.arg === 0) return { ...S.minWidth, title: 'Narrowest a column gets', about: 'Each column is at least this wide; as many columns fit in a row as can.', opts: [[120, 'small tiles'], [160, ''], [200, 'cards'], [240, ''], [260, 'roomy cards'], [320, 'wide cards']] };
    if (/^(?:rotate[xyz]?|skew[xy]?|hue-rotate)$/.test(fn) || p === 'rotate' || (/deg$|turn$/.test(c.unit) && !fn)) return S.turn;
    if (/^scale[xy]?$/.test(fn) || p === 'scale') return S.scale;
    if (fn === 'blur') return S.blur;
    if (/^(?:translate[xy]?|translate)$/.test(fn) || p === 'translate') return { ...S.offset, title: 'Move by', about: 'How far it is moved from where it would be, in pixels or % of its own size. Other things don\'t move out of the way.' };
    if (fn === 'minmax' || fn === 'clamp' || fn === 'min' || fn === 'max' || fn === 'calc') return null;
    if (p === 'opacity') return S.opacity;
    if (p === 'z-index') return S.zIndex;
    if (/^(?:transition|animation)(?:-duration)?$/.test(p)) {
      if (!/^m?s$/.test(c.unit)) return null;
      return /\d\s*m?s\b[^,]*$/.test(c.seg.replace(/^\s*[a-z-]+\s*:?/i, '')) ? S.delay : S.duration;
    }
    if (/^(?:transition|animation)-delay$/.test(p)) return S.delay;
    if (/^(?:top|right|bottom|left|inset)$/.test(p)) return { ...S.offset, title: p === 'inset' ? 'Distance from the edges' : `Distance from the ${p}` };
    if (/^(?:box-shadow|text-shadow)$/.test(p) && !fn) { const k = (c.pre.replace(/^[a-z-]+\s*:?\s*/, '').replace(/^inset\s+/, '').match(/\S+/g) || []).length; return S.shadowPart(Math.min(k, p === 'text-shadow' ? 2 : 3)); }
    if (/^(?:flex-grow|flex-shrink|flex)$/.test(p) && !c.unit) return S.grow;
    if (p === 'aspect-ratio') return S.ratio;
    if (p === 'column-count' || p === 'columns') return S.columnCount;
    if (/^(?:at|placed at)\s+$/.test(w)) return { ...S.offset, title: 'Distance from the left' };
    if (!w && c.opener === ',' && /^\s*(?:at|placed at)\s+-?[\d.]+\s*$/i.test(c.t.slice(0, c.s0).replace(/^.*:/, '').split(',').slice(-2, -1)[0] || '')) return { ...S.offset, title: 'Distance from the top' };
    if (p && /^-{0,2}[a-z]/.test(p) && /-|^(?:top|order|columns|flex|inset|scale|rotate|translate|outline|zoom)$/.test(p)) return { title: plainProp(p), about: `A value for the CSS property ${p}.`, opts: spread, len: /(?:width|height|size|indent|offset|spacing|margin|padding|radius|gap|top|left|right|bottom)$/.test(p) };
    return null;
  });

  /* A spread around a number nothing more is known about. */
  function spread(c) {
    const n = c.n, d = decimals(numPart(c.v));
    const r = (x) => +x.toFixed(Math.min(d + 1, 6));
    const list = [[0, 'none'], [1, ''], [r(n / 2), 'half of it'], [n, 'as written'], [r(n * 2), 'double'], [10, ''], [100, '']];
    if (n < 0) list.push([-n, 'the same, positive'], [-1, '']);
    const seen = new Map();
    for (const [x, l] of list) if (!seen.has(x) || (l && !seen.get(x))) seen.set(x, l);
    for (const x of [2, 5, 50]) if (seen.size < 5 && !seen.has(x)) seen.set(x, '');
    return [...seen].sort((a, b) => a[0] - b[0]);
  }
  function fallback(c) {
    const name = c.setName, part = c.whole ? '' : 'Part of the working-out';
    return {
      title: name && c.whole ? `The starting value of ${name}` : 'A number',
      about: name ? (c.whole ? `The value ${name} is given here. Change it to start ${name} somewhere else.` : `${part} for ${name}.`)
        : /\b(?:is|are)\s+(?:more|less|greater|smaller|bigger|fewer|at least|at most|equal|not)\b[\w\s]*$/i.test(c.before) || /(?:[<>]=?|[=!]==?)\s*$/.test(c.before)
          ? 'The number something is compared with.'
          : /(?:[-+*/%]|\b(?:plus|minus|times|divided by|mod))\s*$/i.test(c.before) || /^\s*(?:[-+*/%]|plus\b|minus\b|times\b|divided by\b)/i.test(c.after) ? 'Part of a sum: change it to change the result.' : 'A number in this sentence.',
      opts: spread,
    };
  }

  /* ---- explain ---- */
  function explain(line, value, lang) {
    const c = context(line, value, lang);
    const v = value;
    if (v.kind === 'hex' || v.kind === 'colour') return explainColour(c);
    let spot = spotFor(c) || fallback(c);
    if (v.kind === 'word') return explainWord(c, spot);
    const get = (k) => (typeof spot[k] === 'function' ? spot[k](c) : spot[k]);
    let unit = c.v.unit || '', list = spot.units && spot.units[unit.toLowerCase()], u = unit, odd = false;
    if (!list) {
      list = get('opts') || spread(c);
      const base = spot.base || '';
      if (unit && unit.toLowerCase() !== base && !(spot.len && unit.toLowerCase() === 'px') && spot.opts !== spread) { list = spread(c); odd = true; }   // a unit this spot has no list for
      else if (!unit && spot.len && rawCss(c)) u = 'px';
    }
    const options = [...list].sort((a, b) => a[0] - b[0]).map(([n, label]) => ({ text: fmt(n) + (n === 0 && /^(?:px|em|rem)$/i.test(u) ? '' : u), label }));
    let step = spot.steps && spot.steps[unit.toLowerCase()] != null ? spot.steps[unit.toLowerCase()] : odd ? undefined : get('step');
    if (step === undefined) step = defaultStep(v);
    const out = { title: get('title'), about: get('about'), options, current: currentIndex(options, v), colour: false, step };
    const min = get('min'), max = get('max');
    if (min != null) out.min = min;
    if (max != null) out.max = max;
    return out;
  }
  /* A CSS property written as CSS (not a style sentence), where a bare length needs a unit. */
  const rawCss = (c) => c.css && (c.raw || /^\s*-{0,2}[a-z][a-z-]*\s*:/i.test(c.seg) || (/-/.test(c.prop || '') && !/^\s*(?:at|text|font|size|space|inner|outer|rounded|round|line|letter)\s/i.test(c.seg)));

  function currentIndex(options, v) {
    if (v.kind === 'number') {
      const u = (v.unit || '').toLowerCase();
      return options.findIndex(o => { const m = o.text.match(/^(-?[\d.]+(?:e[+-]?\d+)?)(.*)$/i); if (!m) return false; const ou = m[2].toLowerCase(); return Math.abs(+m[1] - v.num) < 1e-9 && (ou === u || (!ou && u === 'px') || (!u && ou === 'px') || +m[1] === 0); });
    }
    if (v.kind === 'hex') { const h = toHex(v.text); return options.findIndex(o => toHex(o.text) === h && o.text.length > 1); }
    const low = v.text.toLowerCase();
    return options.findIndex(o => o.text.toLowerCase() === low);
  }

  function explainColour(c) {
    const v = c.v, hex = v.kind === 'hex';
    const upper = hex && /[A-F]/.test(v.text) && !/[a-f]/.test(v.text);
    const options = hex ? HEX_PALETTE.map(([h, label]) => ({ text: upper ? h.toUpperCase() : h, label, swatch: h }))
      : NAME_PALETTE.map(([n, label]) => ({ text: n, label, swatch: toHex(n) }));
    const title = colourTitle(c);
    const about = hex ? 'A colour code: # then two digits each for red, green and blue, from 00 (none) to ff (full). #000000 is black, #ffffff is white.'
      + (v.text.length === 4 ? ' Three digits are a short form: #f80 is #ff8800.' : '') + (v.text.length === 9 || v.text.length === 5 ? ' The last digits are how solid it is: ff is solid, 00 invisible.' : '')
      : v.text.toLowerCase() === 'transparent' ? 'No colour at all: whatever is behind shows through.'
        : `A colour by its name${toHex(v.text) ? ` (the same as ${toHex(v.text)})` : ''}. About 140 names work, from black and white to tomato and skyblue; a code like #1a2b3c gives any colour.`;
    return { title, about, options, current: currentIndex(options, v), colour: true, step: 'colour' };
  }
  function colourTitle(c) {
    const p = c.prop || '', w = c.pre.replace(/["'`]$/, ''), call = c.call;
    if (c.css) {
      if (/^background/.test(p) && !/image/.test(p)) return 'Background colour';
      if (/^(?:color|text|colou?r)$/.test(p) || /^text colou?r\s/.test(w)) return 'Text colour';
      if (BORDERISH.test(p) || /^border.*color$/.test(p)) return /^outline/.test(p) ? 'Outline colour' : 'Border colour';
      if (/shadow$/.test(p) || /^(?:soft |big |strong )?shadow\s/.test(w)) return 'Shadow colour';
      if (/^(?:shared|main) colou?r\s/.test(w) || /^--/.test(p)) return 'Shared colour';
      if (/^(?:accent|caret|scrollbar)-colou?r$/.test(p)) return plainProp(p);
      if (p === 'fill' || p === 'stroke') return p === 'fill' ? 'Fill colour' : 'Line colour';
    }
    if (/\bin\s+$/i.test(c.before) && /^\s+on\b/i.test(c.after)) return 'Colour to draw in';
    if (/^\s*fill\s+\S+\s+with\s+$/i.test(c.before)) return 'Colour to fill with';
    if (c.kw || (call && call.kw)) {
      const k = (c.kw || call.kw).toLowerCase();
      return { fill: 'Fill colour', outline: 'Outline colour', bg: 'Background colour', background: 'Background colour', fg: 'Text colour', foreground: 'Text colour', color: 'Colour', colour: 'Colour', activebackground: 'Background when pressed', highlightbackground: 'Highlight colour' }[k] || 'Colour';
    }
    if (c.setName && c.whole) return `Colour: ${c.setName}`;
    return 'Colour';
  }

  function explainWord(c, spot) {
    const p = c.prop || '';
    let e = spot && spot.list ? spot : WORDS[p];
    if (!e && BORDERISH.test(p)) e = BORDER_WORDS;
    if (!e && /^(?:transition|animation)$/.test(p)) e = TIMING_WORDS;
    if (!e) return { title: 'A word', about: 'A keyword value.', options: [], current: -1, colour: false, step: null };
    const options = e.list.map(([text, label]) => ({ text, label }));
    return { title: e.title, about: e.about, options, current: currentIndex(options, c.v), colour: false, step: 'cycle' };
  }

  /* ---- step ---- */
  function step(line, value, dir, info) {
    if (!value || !dir) return null;
    dir = dir < 0 ? -1 : 1;
    if (value.kind === 'hex' || value.kind === 'colour') return shade(value.text, dir);
    info = info || explain(line, value, arguments[4] || (value.kind === 'word' ? (/^A\d$/.test(value.text) ? 'arduino' : 'css') : 'python'));
    if (value.kind === 'word' || info.step === 'cycle') return cycle(value, dir, info);
    if (value.kind !== 'number' || info.step == null) return null;
    const s = typeof info.step === 'number' && info.step > 0 ? info.step : defaultStep(value);
    let lo = info.min, hi = info.max;
    const t = String(line == null ? '' : line);
    if (!/^-/.test(value.text) && /-\s*$/.test(t.slice(0, value.start))) lo = Math.max(lo == null ? 0 : lo, 0);   // after a minus: x - 1 stays x - 0 at least
    const n = value.num;
    if ((dir < 0 && lo != null && n <= lo) || (dir > 0 && hi != null && n >= hi)) return null;
    let r = n + dir * s;
    if (lo != null && r < lo) r = lo;
    if (hi != null && r > hi) r = hi;
    const text = fmt(r, Math.max(decimals(s), decimals(numPart(value)))) + (value.unit || '');
    return text === value.text ? null : text;
  }
  /* The next or previous option: words wrap round; numbers (serial speeds, notes) go to the next one up or down. */
  function cycle(value, dir, info) {
    const opts = (info && info.options) || [];
    if (!opts.length) return null;
    if (value.kind === 'number') {
      const nums = opts.map(o => parseFloat(o.text)).filter(x => !isNaN(x)).sort((a, b) => a - b);
      const x = dir > 0 ? nums.find(n => n > value.num + 1e-9) : nums.reverse().find(n => n < value.num - 1e-9);
      return x == null ? null : opts.find(o => parseFloat(o.text) === x).text;
    }
    const i = info.current >= 0 ? info.current : currentIndex(opts, value);
    const j = i < 0 ? (dir > 0 ? 0 : opts.length - 1) : (i + dir + opts.length) % opts.length;
    return opts[j].text === value.text ? null : opts[j].text;
  }

  /* Lighter (+) or darker (−) by about 8% lightness, as #rrggbb in the original's letter case; alpha kept. */
  function shade(text, dir) {
    const hex = toHex(text);
    if (!hex) return null;
    let [h, s, l] = toHsl(hex);
    l = Math.min(1, Math.max(0, l + dir * 0.08));
    let out = fromHsl(h, s, l);
    if (out === hex) return null;   // already as light (or dark) as it goes
    const raw = text.trim();
    if (/^#/.test(raw)) {
      const body = raw.slice(1);
      if (body.length === 8) out += body.slice(6);
      else if (body.length === 4) out += body[3] + body[3];
      if (/[A-F]/.test(raw) && !/[a-f]/.test(raw)) out = out.toUpperCase();
    }
    return out;
  }
  function toHsl(hex) {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
    const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
    if (!d) return [0, 0, l];
    const s = d / (1 - Math.abs(2 * l - 1));
    const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [h * 60, s, l];
  }
  function fromHsl(h, s, l) {
    const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
    const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
    return '#' + [f(0), f(8), f(4)].map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
  }

  const api = { scan, explain, step, toHex };
  if (typeof window !== 'undefined') window.IntuiValues = api;
})();

/* IntuaCode — the GUI estimate: an app's windows and what's in them, read from its code, for the Preview.
 *
 * A website shows itself: the Preview runs the page. An app's window (tkinter, JUCE…) can't run in a browser, so the
 * Preview draws an estimate of it from the code: its windows, the groups in them (frames, components inside
 * components) and the parts in those, each where the code puts it. How sure each position is, is said, never hidden:
 *
 *   exact   the code says the numbers (place(x=40, y=20), setBounds(10, 20, 100, 30)); a drag rewrites them
 *   rules   laid out by the toolkit's rules, which are followed here (pack, grid, JUCE's rectangle steps); the
 *           arrangement is right, the sizes are estimated (fonts and native widgets differ)
 *   sketch  the program works it out when it runs (from the window's size, its state, a loop); shown in the order
 *           the code adds it, until the running app is measured (a probe)
 *
 * Nothing about an estimate is kept: it's read again from the code each time it changes.
 *
 *   estimate(files)          -> { toolkits: [...], windows: [Win], notes: [text] }
 *       files: [{ path, code }]: each file as it's written to disk
 *       Win:  { title, toolkit, w, h, root: Node }
 *       Node: { id, kind, name, label, x, y, w, h (in the window), how, src: [{ path, line, role }], children: [Node],
 *               place: how it's placed ('place' | 'pack' | 'grid' | 'bounds' | 'rect' | 'none'), why?: text }
 *             src roles: made (where it's made), placed (where its position is), does (what it does), shown (added)
 *   move(files, node, dx, dy, nodes) -> { path, line, text, x, y } (the code line with the new numbers) or { why }
 *   flat(win)                -> every node of a window, the window first, parents before children
 *   measured(report, est)    -> a layout report (the running app, measured by a probe) as windows the same shape, how
 *                               'measured', each part linked to the estimate's part of the same name; reportIn(text)
 *                               finds a report in what a probe printed; TK_PROBE, JUCE_PROBE are the probes
 *
 * No page here (no DOM): the app and the tests both use it.
 */
(function (root) {
  'use strict';

  /* ---------- the code, read a little: statements, arguments and numbers ---------- */

  // Each logical statement with the line it starts on: lines joined while brackets are open (strings and comments
  // don't count). Python ends a statement at the end of a line; C++ at ";" or a brace.
  function statements(code, lang) {
    const out = [], src = String(code).replace(/\r\n?/g, '\n');
    let cur = '', start = 0, depth = 0, line = 0, q = null, i = 0;
    const push = () => { if (cur.trim()) out.push({ text: cur.trim(), line: start }); cur = ''; };
    while (i < src.length) {
      const c = src[i], n = src[i + 1];
      if (q) {
        cur += c;
        if (c === '\\') { cur += n || ''; i += 2; continue; }
        if (c === q) q = null;
        if (c === '\n') line++;
        i++; continue;
      }
      if (lang === 'py' && c === '#') { while (i < src.length && src[i] !== '\n') i++; continue; }
      if (lang === 'cpp' && c === '/' && n === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
      if (lang === 'cpp' && c === '/' && n === '*') { i += 2; while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] === '\n') line++; i++; } i += 2; continue; }
      if (c === '"' || c === '\'') { if (!cur.trim()) start = line; q = c; cur += c; i++; continue; }
      if (c === '\n') {
        line++;
        if (lang === 'py' && depth <= 0) { push(); depth = 0; i++; continue; }
        cur += ' '; i++; continue;
      }
      if (!cur.trim() && !/\s/.test(c)) start = line;
      if ('([{'.includes(c)) depth++;
      if (')]}'.includes(c)) depth--;
      if (lang === 'cpp' && depth === 0 && (c === ';' || c === '{' || c === '}')) { cur += c; push(); i++; continue; }
      cur += c; i++;
    }
    push();
    return out;
  }

  // "a, b=(1, 2), c='x, y'" -> ['a', 'b=(1, 2)', "c='x, y'"] (commas inside brackets and quotes stay)
  function splitArgs(s) {
    const out = []; let depth = 0, q = null, cur = '';
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (q) { cur += c; if (c === '\\') { cur += s[++i] || ''; } else if (c === q) q = null; continue; }
      if (c === '"' || c === '\'') { q = c; cur += c; continue; }
      if ('([{<'.includes(c) && !(c === '<' && /[\s\d]$/.test(cur))) depth++;
      if (')]}>'.includes(c) && !(c === '>' && depth === 0)) depth--;
      if (c === ',' && depth === 0) { out.push(cur.trim()); cur = ''; continue; }
      cur += c;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  }
  // The text between the bracket at `open` and its partner, and where the partner is.
  function bracket(s, open) {
    let depth = 0, q = null;
    for (let i = open; i < s.length; i++) {
      const c = s[i];
      if (q) { if (c === '\\') i++; else if (c === q) q = null; continue; }
      if (c === '"' || c === '\'') { q = c; continue; }
      if (c === '(' || c === '[' || c === '{') depth++;
      if (c === ')' || c === ']' || c === '}') { depth--; if (!depth) return { inner: s.slice(open + 1, i), end: i }; }
    }
    return null;
  }
  function args(list) {
    const pos = [], kw = {};
    for (const a of splitArgs(list)) {
      const m = a.match(/^([A-Za-z_]\w*)\s*=(?!=)\s*([\s\S]+)$/);
      if (m) kw[m[1]] = m[2].trim(); else pos.push(a);
    }
    return { pos, kw };
  }
  const strOf = (s) => { const m = String(s || '').trim().match(/^[rbuf]*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')$/i); return m ? m[1].slice(1, -1).replace(/\\(.)/g, '$1') : null; };

  /* A number, worked out: digits, + - * / // %, brackets, names whose numbers are known, and a few calls
     (max, min, round, int, jmax, jmin, jlimit, roundToInt). Anything else -> null (not guessed). */
  function num(src, names = {}, extra) {
    const s = String(src).trim();
    if (!s) return null;
    const toks = [];
    const re = /\s*(?:(\d+\.?\d*(?:e[-+]?\d+)?|\.\d+)[fFlLuU]*|((?:[A-Za-z_]\w*(?:::|\.))*[A-Za-z_]\w*)|(\/\/|[-+*\/%(),]))/y;
    let m, at = 0;
    while (at < s.length) {
      re.lastIndex = at;
      m = re.exec(s);
      if (!m || m.index !== at) return null;
      if (m[1] != null) toks.push({ n: parseFloat(m[1]) });
      else if (m[2] != null) toks.push({ id: m[2] });
      else toks.push({ op: m[3] });
      at = re.lastIndex;
      while (at < s.length && /\s/.test(s[at])) at++;
    }
    let p = 0;
    const peek = () => toks[p], take = () => toks[p++];
    const FN = { max: Math.max, min: Math.min, abs: Math.abs, round: Math.round, int: Math.trunc, float: (x) => x,
      jmax: Math.max, jmin: Math.min, jlimit: (lo, hi, v) => Math.min(hi, Math.max(lo, v)), roundToInt: Math.round,
      'juce::jmax': Math.max, 'juce::jmin': Math.min, 'juce::jlimit': (lo, hi, v) => Math.min(hi, Math.max(lo, v)), 'juce::roundToInt': Math.round,
      'std::max': Math.max, 'std::min': Math.min, 'std::round': Math.round, 'std::abs': Math.abs, 'std::floor': Math.floor, 'std::ceil': Math.ceil,
      'math.floor': Math.floor, 'math.ceil': Math.ceil };
    function primary() {
      const t = take();
      if (!t) throw 0;
      if (t.n != null) return t.n;
      if (t.op === '(') { const v = expr(); if (!take() || toks[p - 1].op !== ')') throw 0; return v; }
      if (t.op === '-') return -primary();
      if (t.op === '+') return primary();
      if (t.id) {
        if (peek() && peek().op === '(') {
          take();
          const vals = [];
          if (!(peek() && peek().op === ')')) { do { vals.push(expr()); } while (peek() && peek().op === ',' && take()); }
          if (!take() || toks[p - 1].op !== ')') throw 0;
          const ext = extra && extra(t.id, vals);
          if (ext != null) return ext;
          if (FN[t.id]) return FN[t.id](...vals);
          throw 0;
        }
        const v = names[t.id] ?? names[t.id.replace(/^(?:self|this)(?:\.|->)/, '')] ?? names[t.id.split('::').pop()];
        if (typeof v === 'number') return v;
        const ext = extra && extra(t.id, null);
        if (ext != null) return ext;
        throw 0;
      }
      throw 0;
    }
    function term() {
      let v = primary();
      while (peek() && ['*', '/', '//', '%'].includes(peek().op)) {
        const op = take().op, r = primary();
        v = op === '*' ? v * r : op === '/' ? v / r : op === '//' ? Math.floor(v / r) : v % r;
      }
      return v;
    }
    function expr() {
      let v = term();
      while (peek() && (peek().op === '+' || peek().op === '-')) { const op = take().op; const r = term(); v = op === '+' ? v + r : v - r; }
      return v;
    }
    try { const v = expr(); return p === toks.length && Number.isFinite(v) ? v : null; } catch (e) { return null; }
  }

  /* ---------- tkinter ---------- */

  // what each kind is called here, and its size before anything else is known (Tk's defaults, in its own font)
  const TK_KINDS = { Tk: 'window', Toplevel: 'window', Frame: 'frame', LabelFrame: 'frame', Label: 'label', Button: 'button',
    Entry: 'entry', Text: 'text', Canvas: 'canvas', Listbox: 'list', Scale: 'slider', Checkbutton: 'check', Radiobutton: 'radio',
    Spinbox: 'entry', Scrollbar: 'scrollbar', Combobox: 'choice', Progressbar: 'progress', Treeview: 'list', Notebook: 'frame',
    PanedWindow: 'frame', Message: 'label', OptionMenu: 'choice', Separator: 'line' };
  const CH = 6, LH = 18;   // a character's width and a line's height, roughly, in Tk's default font (as the probe measured them)
  function tkSize(kind, type, o) {
    const n = (k, d) => (o[k] != null ? o[k] : d), text = o.text || '';
    switch (type) {
      case 'Button': return { w: o.width != null ? n('width') * CH + 12 : Math.max(text.length * CH + 15, 30), h: o.height != null ? n('height') * LH + 8 : 26 };
      case 'Label': case 'Message': return { w: o.width != null ? n('width') * CH + 4 : Math.max(text.length * CH, 8), h: o.height != null ? n('height') * LH + 2 : 21 };
      case 'Entry': case 'Spinbox': return { w: n('width', 20) * CH + 4, h: 19 };
      case 'Text': return { w: n('width', 80) * CH + 6, h: n('height', 24) * 16 + 6 };
      case 'Listbox': return { w: n('width', 20) * CH + 6, h: n('height', 10) * 17 + 6 };
      case 'Canvas': return { w: n('width', 378) + 4, h: n('height', 265) + 4 };
      case 'Scale': return /vert/i.test(o.orient || '') ? { w: 40, h: n('length', 100) + 4 } : { w: n('length', 100) + 4, h: 40 };
      case 'Checkbutton': case 'Radiobutton': return { w: text.length * CH + 26, h: 22 };
      case 'Scrollbar': return /hor/i.test(o.orient || '') ? { w: 100, h: 17 } : { w: 17, h: 100 };
      case 'Combobox': case 'OptionMenu': return { w: n('width', 20) * CH + 22, h: 24 };
      case 'Progressbar': return { w: n('length', 100), h: 20 };
      case 'Separator': return /vert/i.test(o.orient || '') ? { w: 2, h: 20 } : { w: 20, h: 2 };
      default: return { w: o.width != null ? n('width') : 0, h: o.height != null ? n('height') : 0 };
    }
  }

  function readTk(file) {
    const stmts = statements(file.code, 'py');
    const pre = new Set(), bare = new Set();
    for (const s of stmts) {
      let m;
      if ((m = s.text.match(/^import\s+tkinter(?:\s+as\s+(\w+))?$/))) pre.add((m[1] || 'tkinter') + '.');
      if ((m = s.text.match(/^import\s+tkinter\.ttk(?:\s+as\s+(\w+))?$/))) pre.add((m[1] || 'tkinter.ttk') + '.');
      if ((m = s.text.match(/^from\s+tkinter(?:\.ttk)?\s+import\s+(.+)$/))) {
        for (const w of m[1].replace(/[()]/g, '').split(',').map(x => x.trim())) {
          const [name, as] = w.split(/\s+as\s+/);
          if (name === '*') Object.keys(TK_KINDS).forEach(k => bare.add(k));
          else if (name === 'ttk') pre.add((as || 'ttk') + '.');
          else if (TK_KINDS[name]) bare.add(as || name);
        }
      }
    }
    if (!pre.size && !bare.size) return null;
    const names = {}, widgets = [], byName = new Map(), notes = [];
    const kindOf = (call) => {
      for (const p of pre) if (call.startsWith(p)) { const t = call.slice(p.length); if (TK_KINDS[t]) return t; }
      return bare.has(call) && TK_KINDS[call] ? call : null;
    };
    const val = (v) => { const s = strOf(v); if (s != null) return s; return num(v, names); };
    const opts = (kw) => { const o = {}; for (const [k, v] of Object.entries(kw)) { const x = val(v); if (x != null) o[k] = x; } return o; };
    // a placing call's settings, worked out: numbers (named ones too: padx=PAD), and words (tk.TOP, "left", tk.BOTH, True)
    const geom = (w, how, list, line, text) => {
      const a = args(list), v = {};
      for (const [k, x] of Object.entries(a.kw)) {
        const t = x.trim(), n = num(t, names), s = strOf(t);
        const pair = t.match(/^\(\s*([^,]+),\s*([^)]+)\)$/);
        v[k] = pair ? [num(pair[1], names) ?? 0, num(pair[2], names) ?? 0] : n != null ? n : s != null ? s.toLowerCase() : /^(?:True|true)$/.test(t) ? 1 : /^(?:False|false)$/.test(t) ? 0 : t.replace(/^(?:\w+\.)+/, '').toLowerCase();
      }
      w.geom = { how, ...a, v, line, text };
      w.src.push({ path: file.path, line, role: 'placed' });
    };
    for (const s of stmts) {
      const t = s.text;
      let m;
      // a number the code names: COLUMNS = 20, CELL = 24, SIZE = COLUMNS * CELL
      if ((m = t.match(/^([A-Za-z_][\w.]*)\s*=\s*([^=].*)$/)) && !/\(/.test(m[2].replace(/\b(?:max|min|int|round|float)\(/g, ''))) {
        const v = num(m[2], names);
        if (v != null) names[m[1]] = v;
      }
      // a widget made: [name =] tk.Button(parent, …)[.pack(…)|.grid(…)|.place(…)]
      const made = t.match(/^(?:([A-Za-z_][\w.]*)\s*=\s*)?([A-Za-z_][\w.]*)\s*\(/);
      const type = made && kindOf(made[2]);
      if (type) {
        const open = t.indexOf('(', made[0].length - 1), b = bracket(t, open);
        if (!b) continue;
        const a = args(b.inner), parentName = a.kw.master || a.pos[0];
        const w = { type, kind: TK_KINDS[type], name: made[1] || null, parent: type === 'Tk' ? null : (parentName && byName.get(parentName.trim())) || null,
          parentName: parentName ? parentName.trim() : null, o: opts(a.kw), src: [{ path: file.path, line: s.line, role: 'made' }], geom: null, children: [] };
        if (a.kw.command) w.src.push({ path: file.path, line: s.line, role: 'does', fn: a.kw.command.trim() });
        widgets.push(w);
        if (w.name) byName.set(w.name, w);
        if (w.parent) w.parent.children.push(w);
        const rest = t.slice(b.end + 1).match(/^\s*\.\s*(pack|grid|place)\s*\(/);
        if (rest) { const g = bracket(t, b.end + 1 + rest[0].length - 1); if (g) geom(w, rest[1], g.inner, s.line, t); }
        if (made[1] && rest) notes.push(`${made[1]} is set to what ${rest[1]}() gives back (None), not to the ${type}: the window still shows it, but ${made[1]} can't change it later. Put .${rest[1]}(…) on a line of its own.`);
        continue;
      }
      // placed later: name.pack(…), name.grid(…), name.place(…)
      if ((m = t.match(/^([A-Za-z_][\w.]*)\s*\.\s*(pack|grid|place)\s*\(/)) && byName.has(m[1])) {
        const g = bracket(t, m[0].length - 1);
        if (g) geom(byName.get(m[1]), m[2], g.inner, s.line, t);
        continue;
      }
      // the window: root.geometry("400x300"), root.title("…")
      if ((m = t.match(/^([A-Za-z_][\w.]*)\s*\.\s*(geometry|title|config|configure)\s*\(/)) && byName.has(m[1])) {
        const w = byName.get(m[1]), g = bracket(t, m[0].length - 1);
        if (!g) continue;
        const a = args(g.inner);
        if (m[2] === 'geometry') { const size = strOf(a.pos[0] || '') || ''; const sm = size.match(/^(\d+)x(\d+)/); if (sm) { w.size = { w: +sm[1], h: +sm[2] }; w.src.push({ path: file.path, line: s.line, role: 'placed' }); } }
        else if (m[2] === 'title') { const v = strOf(a.pos[0] || ''); if (v != null) w.title = v; }
        else Object.assign(w.o, opts(a.kw));
        continue;
      }
      // what a name does when used: name.bind(…), name.config(command=…)
      if ((m = t.match(/^([A-Za-z_][\w.]*)\s*\.\s*(bind|bind_all|after)\s*\(/)) && byName.has(m[1])) byName.get(m[1]).src.push({ path: file.path, line: s.line, role: 'does' });
    }
    // what each one's tool does: the def it names
    const defs = new Map();
    stmts.forEach((s) => { const m = s.text.match(/^(?:async\s+)?def\s+(\w+)\s*\(/); if (m) defs.set(m[1], s.line); });
    for (const w of widgets) for (const sx of w.src) if (sx.fn) { const d = defs.get(sx.fn.replace(/^(?:self\.)/, '')); if (d != null) w.src.push({ path: file.path, line: d, role: 'does' }); delete sx.fn; }
    return { widgets, notes };
  }

  /* Tk's packer and gridder, followed: what each widget asks for, then where each goes. */
  function tkRequest(w) {
    const own = tkSize(w.kind, w.type, w.o);
    const kids = w.children.filter(c => c.geom);
    for (const c of kids) tkRequest(c);
    const pad = (c, k) => { const v = c.geom.v[k]; return Array.isArray(v) ? v : typeof v === 'number' ? [v, v] : [0, 0]; };
    let pw = 0, ph = 0;
    const packed = kids.filter(c => c.geom.how === 'pack');
    if (packed.length) {
      let width = 0, height = 0, maxW = 0, maxH = 0;
      for (const c of packed) {
        const side = typeof c.geom.v.side === 'string' && /^(?:top|bottom|left|right)$/.test(c.geom.v.side) ? c.geom.v.side : 'top';
        const [px1, px2] = pad(c, 'padx'), [py1, py2] = pad(c, 'pady');
        c.pad = { px1, px2, py1, py2, side };
        if (side === 'top' || side === 'bottom') { maxW = Math.max(maxW, c.req.w + px1 + px2 + width); height += c.req.h + py1 + py2; }
        else { maxH = Math.max(maxH, c.req.h + py1 + py2 + height); width += c.req.w + px1 + px2; }
      }
      pw = Math.max(maxW, width); ph = Math.max(maxH, height);
    }
    const gridded = kids.filter(c => c.geom.how === 'grid');
    if (gridded.length) {
      const cols = [], rows = [];
      for (const c of gridded) {
        const n = (k, d) => (typeof c.geom.v[k] === 'number' ? c.geom.v[k] : d);
        const r = n('row', 0), col = n('column', 0);
        const [px1, px2] = pad(c, 'padx'), [py1, py2] = pad(c, 'pady');
        const cs = n('columnspan', 1), rs = n('rowspan', 1);
        c.cell = { r, c: col, cs, rs, px1, px2, py1, py2, sticky: String(c.geom.v.sticky || '').replace(/[^nsew]/g, '') };
        if (cs === 1) cols[col] = Math.max(cols[col] || 0, c.req.w + px1 + px2);
        if (rs === 1) rows[r] = Math.max(rows[r] || 0, c.req.h + py1 + py2);
      }
      w.gridCols = Array.from(cols, v => v || 0); w.gridRows = Array.from(rows, v => v || 0);
      pw = Math.max(pw, w.gridCols.reduce((a, b) => a + b, 0)); ph = Math.max(ph, w.gridRows.reduce((a, b) => a + b, 0));
    }
    w.req = (packed.length || gridded.length) && w.kind !== 'canvas' ? { w: Math.max(pw, 1), h: Math.max(ph, 1) } : { w: own.w || (w.kind === 'frame' ? 40 : 8), h: own.h || (w.kind === 'frame' ? 24 : 8) };
    if (w.kind === 'window' && w.size) w.req = { ...w.size };
  }
  function tkArrange(w, x, y, W, H) {
    w.box = { x, y, w: W, h: H };
    let cav = { x, y, w: W, h: H };
    for (const c of w.children.filter(c => c.geom && c.geom.how === 'pack')) {
      const { px1, px2, py1, py2, side } = c.pad, fill = String(c.geom.v.fill || '');
      const expand = c.geom.v.expand === 1 || /^(?:yes|true)$/.test(String(c.geom.v.expand));
      let parcel;
      if (side === 'top' || side === 'bottom') {
        const ph = expand ? Math.max(c.req.h + py1 + py2, cav.h) : Math.min(cav.h, c.req.h + py1 + py2);
        parcel = { x: cav.x, y: side === 'top' ? cav.y : cav.y + cav.h - ph, w: cav.w, h: ph };
        if (side === 'top') cav.y += ph;
        cav.h -= ph;
      } else {
        const pw = expand ? Math.max(c.req.w + px1 + px2, cav.w) : Math.min(cav.w, c.req.w + px1 + px2);
        parcel = { x: side === 'left' ? cav.x : cav.x + cav.w - pw, y: cav.y, w: pw, h: cav.h };
        if (side === 'left') cav.x += pw;
        cav.w -= pw;
      }
      const iw = parcel.w - px1 - px2, ih = parcel.h - py1 - py2;
      const cw = /^(?:x|both)$/.test(fill) ? iw : Math.min(c.req.w, iw), ch = /^(?:y|both)$/.test(fill) ? ih : Math.min(c.req.h, ih);
      tkArrange(c, parcel.x + px1 + (iw - cw) / 2, parcel.y + py1 + (ih - ch) / 2, Math.max(cw, 0), Math.max(ch, 0));
    }
    if (w.gridCols) {
      const xs = [0], ys = [0];
      w.gridCols.forEach((v, i) => xs.push(xs[i] + v)); w.gridRows.forEach((v, i) => ys.push(ys[i] + v));
      const ox = x, oy = y;   // (a grid smaller than its frame sits at its top left: grid's anchor is nw unless grid_anchor says)
      w.gridAt = { ox, oy, xs, ys };
      for (const c of w.children.filter(c => c.geom && c.geom.how === 'grid')) {
        const k = c.cell, cx = ox + xs[k.c], cy = oy + ys[k.r];
        const cw = (xs[Math.min(k.c + k.cs, xs.length - 1)] - xs[k.c]) - k.px1 - k.px2, ch = (ys[Math.min(k.r + k.rs, ys.length - 1)] - ys[k.r]) - k.py1 - k.py2;
        const fw = /e/.test(k.sticky) && /w/.test(k.sticky) ? cw : Math.min(c.req.w, cw), fh = /n/.test(k.sticky) && /s/.test(k.sticky) ? ch : Math.min(c.req.h, ch);
        const ax = /w/.test(k.sticky) && !/e/.test(k.sticky) ? 0 : /e/.test(k.sticky) && !/w/.test(k.sticky) ? cw - fw : (cw - fw) / 2;
        const ay = /n/.test(k.sticky) && !/s/.test(k.sticky) ? 0 : /s/.test(k.sticky) && !/n/.test(k.sticky) ? ch - fh : (ch - fh) / 2;
        tkArrange(c, cx + k.px1 + ax, cy + k.py1 + ay, Math.max(fw, 0), Math.max(fh, 0));
      }
    }
    for (const c of w.children.filter(c => c.geom && c.geom.how === 'place')) {
      const n = (k, d) => (typeof c.geom.v[k] === 'number' ? c.geom.v[k] : d);
      const cw = n('width', null) ?? (n('relwidth', null) != null ? n('relwidth') * W : c.req.w);
      const ch = n('height', null) ?? (n('relheight', null) != null ? n('relheight') * H : c.req.h);
      tkArrange(c, x + (n('x', 0) ?? 0) + (n('relx', 0) ?? 0) * W, y + (n('y', 0) ?? 0) + (n('rely', 0) ?? 0) * H, cw, ch);
    }
  }
  function tkNode(w, ids) {
    const name = w.name ? w.name.replace(/^self\./, '') : null;
    let id = (name || w.kind).replace(/[^\w-]+/g, '-');
    for (let k = 2; ids.has(id); k++) id = `${name || w.kind}-${k}`;
    ids.add(id);
    const g = w.geom, how = !g ? 'window' : g.how === 'place' ? (/^-?\d+$/.test(String(g.kw.x || '0').trim()) && /^-?\d+$/.test(String(g.kw.y || '0').trim()) ? 'exact' : 'rules') : 'rules';
    const node = { id, kind: w.kind, type: w.type, name, label: w.o.text != null ? String(w.o.text) : w.title || '', how: w.kind === 'window' ? 'exact' : how,
      x: Math.round(w.box.x), y: Math.round(w.box.y), w: Math.round(w.box.w), h: Math.round(w.box.h), src: w.src, place: g ? g.how : w.kind === 'window' ? 'window' : 'none', children: [], geom: g || null, cell: w.cell || null, grid: w.gridAt || null };
    node.children = w.children.filter(c => c.geom).map(c => tkNode(c, ids));
    return node;
  }
  function tkWindows(file, read) {
    const wins = [], notes = [...read.notes];
    for (const w of read.widgets.filter(w => w.kind === 'window')) {
      tkRequest(w);
      tkArrange(w, 0, 0, w.req.w, w.req.h);
      wins.push({ title: w.title || (w.name || 'window'), toolkit: 'tkinter', path: file.path, w: Math.round(w.req.w), h: Math.round(w.req.h), root: tkNode(w, new Set()) });
    }
    for (const w of read.widgets) if (w.kind !== 'window' && !w.geom) notes.push(`${w.name || 'A ' + w.type} (${file.path}, line ${w.src[0].line + 1}) is made but never placed (no pack, grid or place), so the window doesn't show it.`);
    for (const w of read.widgets) if (w.kind !== 'window' && w.parentName && !w.parent) notes.push(`${w.name || 'A ' + w.type} (${file.path}, line ${w.src[0].line + 1}) goes in ${w.parentName}, which isn't a window or frame read here, so it isn't shown.`);
    return { windows: wins, notes };
  }

  /* ---------- JUCE (C++) ---------- */

  const JUCE_KINDS = { Slider: 'slider', TextButton: 'button', ToggleButton: 'check', ImageButton: 'button', DrawableButton: 'button', ArrowButton: 'button', ShapeButton: 'button',
    Label: 'label', ComboBox: 'choice', TextEditor: 'entry', ImageComponent: 'picture', ListBox: 'list', TreeView: 'list', TabbedComponent: 'frame', GroupComponent: 'frame',
    Viewport: 'frame', MidiKeyboardComponent: 'keyboard', HyperlinkButton: 'link', ProgressBar: 'progress', Component: 'frame' };
  const COMPONENT_BASES = /\b(?:juce::)?(?:Component|AudioProcessorEditor|DocumentWindow|ResizableWindow)\b/;
  function juceSize(type, rotary, vertical) {
    if (type === 'Slider') return rotary ? { w: 64, h: 64 } : vertical ? { w: 36, h: 140 } : { w: 160, h: 24 };
    return { TextButton: { w: 90, h: 26 }, ToggleButton: { w: 100, h: 24 }, Label: { w: 110, h: 22 }, ComboBox: { w: 140, h: 24 }, TextEditor: { w: 160, h: 24 },
      ImageComponent: { w: 100, h: 100 }, MidiKeyboardComponent: { w: 400, h: 70 }, HyperlinkButton: { w: 100, h: 20 }, ProgressBar: { w: 160, h: 20 } }[type] || { w: 120, h: 90 };
  }

  /* C++ with its comments blanked out (each character a space, its lines kept), so what's in them (an apostrophe, a
     brace) isn't read as code, and every place in it is where it was. */
  function blankComments(code) {
    let out = '', q = null;
    for (let i = 0; i < code.length; i++) {
      const c = code[i], n = code[i + 1];
      if (q) { out += c; if (c === '\\') { out += n || ''; i++; } else if (c === q || c === '\n') q = null; continue; }
      if (c === '/' && n === '/') { while (i < code.length && code[i] !== '\n') { out += ' '; i++; } i--; continue; }
      if (c === '/' && n === '*') { out += '  '; i += 2; while (i < code.length && !(code[i] === '*' && code[i + 1] === '/')) { out += code[i] === '\n' ? '\n' : ' '; i++; } out += '  '; i++; continue; }
      if (c === '"') q = c;
      else if (c === '\'' && !/[0-9a-fA-F]/.test(code[i - 1] || '')) q = c;   // (1'000 is a number)
      out += c;
    }
    return out;
  }

  /* A member's type, unwrapped: juce::Slider, console::ConsolePage, std::unique_ptr<T>, std::array<T, N>,
     std::array<std::unique_ptr<T>, N>, std::vector<T>, juce::OwnedArray<T> -> { type (its last name), many } */
  function memberType(t, consts) {
    let s = String(t).trim(), many = 1, m;
    for (let k = 0; k < 4; k++) {
      if ((m = s.match(/^(?:std::)?unique_ptr\s*<\s*(.+)\s*>$/))) { s = m[1].trim(); continue; }
      if ((m = s.match(/^(?:std::)?array\s*<\s*(.+)\s*,\s*([^,<>]+)\s*>$/))) { const n = num(m[2], consts); many = n != null ? many * n : null; s = m[1].trim(); continue; }
      if ((m = s.match(/^(?:std::vector|(?:juce::)?OwnedArray|(?:juce::)?Array)\s*<\s*(.+)\s*>$/))) { many = null; s = m[1].trim(); continue; }
      break;
    }
    if (!/^[\w:]+$/.test(s)) return null;
    return { type: s.split('::').pop(), many };
  }

  /* Every class that's a Component: its members, what it adds, where it places them, and what they do, from any
     file (a .h declares, a .cpp defines). Numbers the code names (constexpr int channelCount = 16) are known too. */
  function readJuce(files) {
    const classes = new Map(), consts = {};
    const cls = (name) => classes.get(name) || classes.set(name, { name, bases: '', members: new Map(), added: [], size: null, resized: null, does: [], src: [], labels: new Map(), styles: new Map(), content: false }).get(name);
    // constexpr numbers, in any file (twice: one can be made of another)
    for (let pass = 0; pass < 2; pass++) {
      for (const f of files) for (const m of String(f.code).matchAll(/\b(?:static\s+)?(?:inline\s+)?constexpr\s+(?:int|float|double|auto|unsigned|long|(?:std::)?size_t)\s+(\w+)\s*(?:=\s*([^;{}]+)|\{\s*([^;{}]+)\s*\});/g)) {
        if (consts[m[1]] != null) continue;
        const v = num((m[2] || m[3]).replace(/\b(?:static_cast|int|float)\s*<[^>]*>/g, ''), consts);
        if (v != null) consts[m[1]] = v;
      }
    }
    const bodies = [], opened = new Set();
    for (const f of files) {
      const code = blankComments(String(f.code).replace(/\r\n?/g, '\n'));   // (an apostrophe in a comment isn't a character)
      const lineAt = (i) => code.slice(0, i).split('\n').length - 1;
      // class Name [final] : public juce::Component … { body }
      for (const m of code.matchAll(/\b(?:class|struct)\s+(\w+)\s*(?:final\s*)?:\s*([^{;]+)\{/g)) {
        if (!COMPONENT_BASES.test(m[2])) continue;
        const open = m.index + m[0].length - 1, b = bracket(code, open);
        if (!b) continue;
        const c = cls(m[1]);
        c.bases = m[2]; c.src.push({ path: f.path, line: lineAt(m.index), role: 'made' });
        bodies.push({ c, f, code, from: open + 1, text: b.inner, lineAt });
      }
      // Name::fn(…) [const] [: member(…), member{…}] { … }, outside the class: the body is the brace after all that
      for (const m of code.matchAll(/\b(\w+)::(~?\w+)\s*\(/g)) {
        const params = bracket(code, m.index + m[0].length - 1);
        if (!params) continue;
        let i = params.end + 1, initFrom = -1, initTo = -1;
        const ws = () => { while (i < code.length && /\s/.test(code[i])) i++; };
        ws();
        for (let q; (q = code.slice(i, i + 12).match(/^(?:const|noexcept|override|final)\b/));) { i += q[0].length; ws(); }
        if (code[i] === ':' && code[i + 1] !== ':') {
          i++; initFrom = i;
          for (;;) {
            ws();
            const id = code.slice(i, i + 200).match(/^[\w:]+(?:\s*<[^;{}()]*>)?/);
            if (!id) break;
            i += id[0].length; ws();
            if (code[i] !== '(' && code[i] !== '{') break;
            const b = bracket(code, i);
            if (!b) break;
            i = b.end + 1; ws();
            if (code[i] === ',') { i++; continue; }
            break;
          }
          initTo = i;
        }
        if (code[i] !== '{') continue;
        const b = bracket(code, i);
        if (!b) continue;
        bodies.push({ owner: m[1], fn: m[2], f, code, from: i + 1, text: b.inner, lineAt, init: initFrom >= 0 ? code.slice(initFrom, initTo) : '' });
      }
      // the window's content: setContentOwned(new Name …) or (content = new Name …)
      for (const m of code.matchAll(/\bnew\s+(?:[\w]+::)*(\w+)\s*[({]/g)) opened.add(m[1]);
    }
    // any of its functions: what it adds (anywhere: loops too), its size, its parts' text and style, what they do
    const readFn = (c, fn, text, from, f, lineAt, init) => {
      const at = (i) => lineAt(from + i);
      for (const a of String(init || '').matchAll(/(\w+)\s*\{\s*(?:\{\s*\}\s*,\s*)?("(?:[^"\\]|\\.)*")/g)) c.labels.set(a[1], strOf(a[2]));
      // a loop's name stands for what it goes through: for (auto& bus : busStrips) addAndMakeVisible(bus) adds busStrips
      const through = new Map();
      for (const m of text.matchAll(/\bfor\s*\(\s*(?:const\s+)?(?:auto|[\w:<>]+)\s*[&*]*\s*(\w+)\s*:\s*(?:this->)?(\w+)\s*\)/g)) through.set(m[1], m[2]);
      for (const m of text.matchAll(/\badd(AndMakeVisible|ChildComponent)\s*\(\s*([&*]?)\s*(?:this->)?(\w+)(\s*\[[^\]]*\])?/g)) {
        const name = through.get(m[3]) || m[3];
        c.added.push({ name, hidden: m[1] === 'ChildComponent', line: at(m.index), path: f.path, indexed: !!m[4] || through.has(m[3]) });
      }
      if (fn === c.name) for (const m of text.matchAll(/(?:^|[;{}\s])(?:this->)?setSize\s*\(([^;]+)\)\s*;/g)) {
        const a = splitArgs(m[1]); const w = num(a[0], consts), h = num(a[1], consts);
        if (w != null && h != null && !c.size) c.size = { w, h, line: at(m.index + m[0].indexOf('setSize')), path: f.path };
      }
      for (const m of text.matchAll(/\b(\w+)(?:\s*\[[^\]]*\])?\s*(?:\.|->)\s*(setButtonText|setText)\s*\(\s*("(?:[^"\\]|\\.)*")/g)) if (!c.labels.has(m[1])) c.labels.set(m[1], strOf(m[3]));
      for (const m of text.matchAll(/\b(\w+)(?:\s*\[[^\]]*\])?\s*(?:\.|->)\s*setSliderStyle\s*\(([^)]*)\)/g)) c.styles.set(m[1], m[2]);
      for (const m of text.matchAll(/\b(\w+)(?:\s*\[[^\]]*\])?\s*(?:\.|->)\s*(onClick|onValueChange|onChange|onTextChange|onStateChange|addListener)\b/g)) c.does.push({ name: m[1], line: at(m.index), path: f.path });
      if (fn === 'resized') c.resized = { text, from, f, lineAt };
    };
    for (const b of bodies.filter(b => b.c)) {
      const { c, text, from, f, lineAt } = b;
      // members at the class's own level (Type name; Type name { … }; Type name[N];), and the functions written inside it
      let depth = 0, cur = '', curAt = 0;
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (ch === '{') {
          if (depth === 0 && /\)\s*(?:const\s*)?(?:override\s*)?(?:noexcept\s*)?(?:final\s*)?(?::[^;{]*)?$/.test(cur)) {
            const end = bracket(text, i), sig = cur.match(/(~?\w+)\s*\(([^)]*)\)[^(]*$/);
            if (sig && end) readFn(c, sig[1], end.inner, from + i + 1, f, lineAt, (cur.match(/\)\s*:\s*([^{]*)$/) || [])[1] || '');
            if (end) { i = end.end; cur = ''; continue; }
          }
          depth++;
        } else if (ch === '}') depth--;
        if (depth === 0 && ch === ';') {
          const d = cur.trim().replace(/^(?:(?:private|public|protected)\s*:\s*)+/, '').replace(/^(?:mutable|static|inline|const)\s+/g, '');
          // Type name[N] { … } = …, other …;  (the type may have <…> in it; several names can share it)
          const m = d.match(/^([\w:]+(?:\s*<[^;=(){}]*>)?)\s+([A-Za-z_][\s\S]*)$/);
          const t = m && !/^(?:using|return|typedef|friend|enum|class|struct|template|virtual|operator)$/.test(m[1]) ? memberType(m[1], consts) : null;
          if (t) for (const one of splitArgs(m[2])) {
            const dm = one.match(/^(\w+)\s*(?:\[\s*([^\]]+)\s*\])?\s*(?:\{\s*(?:\{\s*\}\s*,\s*)?("(?:[^"\\]|\\.)*")?[^}]*\}|=\s*[\s\S]+)?$/);
            if (!dm) continue;
            let many = t.many;
            if (dm[2]) { const n = num(dm[2], consts); many = many == null || n == null ? null : many * n; }
            c.members.set(dm[1], { name: dm[1], type: t.type, many, label: dm[3] ? strOf(dm[3]) : null, line: lineAt(from + curAt), path: f.path });
          }
          cur = ''; continue;
        }
        if (!cur.trim()) curAt = i;
        if (depth === 0 || ch !== '}') cur += ch;
      }
    }
    for (const b of bodies.filter(b => b.owner && classes.has(b.owner))) readFn(classes.get(b.owner), b.fn, b.text, b.from, b.f, b.lineAt, b.init);
    for (const c of classes.values()) {
      for (const [n, l] of c.labels) { const mem = c.members.get(n); if (mem && mem.label == null) mem.label = l; }
      for (const [n, st] of c.styles) { const mem = c.members.get(n); if (mem) { mem.rotary = /Rotary/.test(st); mem.vertical = /Vertical/.test(st) && !mem.rotary; } }
    }
    for (const c of classes.values()) c.content = opened.has(c.name);
    return { classes, consts };
  }

  /* JUCE's rectangle steps, followed: getLocalBounds(), removeFromTop(n), reduced(n), withSizeKeepingCentre(w, h)…,
     with numbers worked out as above. A step it doesn't know (or a number from the program's state) -> null. */
  function rectSteps(resized, W, H, consts) {
    const vars = {}, nums = { ...consts }, placed = new Map();
    const R = (x, y, w, h) => ({ x, y, w, h });
    const numOf = (s) => num(s, nums, (id, vals) => {
      if (vals == null) return null;
      if (id === 'getWidth' && !vals.length) return W;
      if (id === 'getHeight' && !vals.length) return H;
      if (id === 'proportionOfWidth' && vals.length === 1) return W * vals[0];
      if (id === 'proportionOfHeight' && vals.length === 1) return H * vals[0];
      return null;
    });
    // a rectangle expression: a base, then steps; steps that cut (removeFrom…) change the variable they're on
    function rect(src) {
      let s = String(src).trim(), r = null, baseVar = null, m;
      if ((m = s.match(/^(?:this->)?getLocalBounds\s*\(\s*\)/))) { r = R(0, 0, W, H); s = s.slice(m[0].length); }
      else if ((m = s.match(/^(?:juce::)?Rectangle\s*<\s*\w+\s*>\s*\(([^()]*(?:\([^()]*\)[^()]*)*)\)/) || s.match(/^\{([^{}]*)\}/))) {
        const a = splitArgs(m[1]).map(numOf); if (a.length !== 4 || a.some(v => v == null)) return null;
        r = R(...a); s = s.slice(m[0].length);
      } else if ((m = s.match(/^([A-Za-z_]\w*)/)) && vars[m[1]]) { baseVar = m[1]; r = { ...vars[m[1]] }; s = s.slice(m[0].length); }
      else return null;
      let first = true;
      while (s.trim()) {
        const sm = s.match(/^\s*\.\s*(\w+)\s*\(/);
        if (!sm) return null;
        const b = bracket(s, sm[0].length - 1);
        if (!b) return null;
        const a = b.inner.trim() ? splitArgs(b.inner).map(numOf) : [];
        if (a.some(v => v == null)) return null;
        const f = sm[1], cut = (side) => {
          const n = Math.max(0, Math.min(a[0], side === 'Top' || side === 'Bottom' ? r.h : r.w));
          const got = side === 'Top' ? R(r.x, r.y, r.w, n) : side === 'Bottom' ? R(r.x, r.y + r.h - n, r.w, n) : side === 'Left' ? R(r.x, r.y, n, r.h) : R(r.x + r.w - n, r.y, n, r.h);
          const left = side === 'Top' ? R(r.x, r.y + n, r.w, r.h - n) : side === 'Bottom' ? R(r.x, r.y, r.w, r.h - n) : side === 'Left' ? R(r.x + n, r.y, r.w - n, r.h) : R(r.x, r.y, r.w - n, r.h);
          if (first && baseVar) vars[baseVar] = left;
          return got;
        };
        if ((m = f.match(/^removeFrom(Top|Bottom|Left|Right)$/))) r = cut(m[1]);
        else if (f === 'reduced') { const dx = a[0] ?? 0, dy = a[1] ?? a[0] ?? 0; r = R(r.x + dx, r.y + dy, r.w - 2 * dx, r.h - 2 * dy); }
        else if (f === 'expanded') { const dx = a[0] ?? 0, dy = a[1] ?? a[0] ?? 0; r = R(r.x - dx, r.y - dy, r.w + 2 * dx, r.h + 2 * dy); }
        else if ((m = f.match(/^withTrimmed(Top|Bottom|Left|Right)$/))) { const n = a[0]; r = m[1] === 'Top' ? R(r.x, r.y + n, r.w, r.h - n) : m[1] === 'Bottom' ? R(r.x, r.y, r.w, r.h - n) : m[1] === 'Left' ? R(r.x + n, r.y, r.w - n, r.h) : R(r.x, r.y, r.w - n, r.h); }
        else if (f === 'withSizeKeepingCentre') r = R(r.x + (r.w - a[0]) / 2, r.y + (r.h - a[1]) / 2, a[0], a[1]);
        else if (f === 'withWidth') r = R(r.x, r.y, a[0], r.h);
        else if (f === 'withHeight') r = R(r.x, r.y, r.w, a[0]);
        else if (f === 'withX') r = R(a[0], r.y, r.w, r.h);
        else if (f === 'withY') r = R(r.x, a[0], r.w, r.h);
        else if (f === 'withPosition') r = R(a[0], a[1], r.w, r.h);
        else if (f === 'withSize') r = R(r.x, r.y, a[0], a[1]);
        else if (f === 'translated') r = R(r.x + a[0], r.y + a[1], r.w, r.h);
        else if (f === 'withZeroOrigin') r = R(0, 0, r.w, r.h);
        else if (f === 'toFloat' || f === 'toNearestInt' || f === 'getSmallestIntegerContainer') { /* the same box */ }
        else return null;
        s = s.slice(b.end + 1);
        first = false;
      }
      return r;
    }
    const numFromRect = (s) => { const m = String(s).match(/^(.*)\.\s*get(X|Y|Width|Height|Right|Bottom|CentreX|CentreY)\s*\(\s*\)$/); if (!m) return null; const r = rect(m[1]); if (!r) return null; return { X: r.x, Y: r.y, Width: r.w, Height: r.h, Right: r.x + r.w, Bottom: r.y + r.h, CentreX: r.x + r.w / 2, CentreY: r.y + r.h / 2 }[m[2]]; };
    for (const s of statements(resized.text, 'cpp')) {
      let t = s.text.replace(/;$/, '').trim();
      const line = resized.lineAt(resized.from + resized.text.indexOf(s.text));
      // (placed when something's so: if (consolePage) consolePage->setBounds(…) is still where it goes when shown)
      if (/^if\s*\(/.test(t)) { const b = bracket(t, t.indexOf('(')); if (b) t = t.slice(b.end + 1).trim().replace(/^\{|\}$/g, '').trim(); }
      let m;
      if ((m = t.match(/^(?:auto|(?:juce::)?Rectangle\s*<\s*\w+\s*>|const\s+auto)\s*&?\s*(\w+)\s*=\s*(.+)$/))) {
        const r = rect(m[2]);
        if (r) { vars[m[1]] = r; continue; }
        const n = numOf(m[2]) ?? numFromRect(m[2]);
        if (n != null) nums[m[1]] = n;
        continue;
      }
      if ((m = t.match(/^(?:const\s+)?(?:int|float|double|auto)\s+(\w+)\s*=\s*(.+)$/))) { const n = numOf(m[2]) ?? numFromRect(m[2]); if (n != null) nums[m[1]] = n; continue; }
      if ((m = t.match(/^([\w.]+?)(?:\.|->)setBounds\s*\((.*)\)$/))) {
        const a = splitArgs(m[2]);
        if (a.length === 4) { const v = a.map(numOf); placed.set(m[1], { box: v.some(x => x == null) ? null : R(...v), how: a.every(x => /^-?\d+$/.test(x.trim())) ? 'exact' : 'rules', line, path: resized.f.path, text: t }); }
        else { const r = a.length === 1 ? rect(a[0]) : null; placed.set(m[1], { box: r, how: 'rules', line, path: resized.f.path, text: t }); }
        continue;
      }
      if ((m = t.match(/^(\w+)\s*\.\s*removeFrom(Top|Bottom|Left|Right)\s*\(/)) && vars[m[1]]) { rect(t); continue; }
    }
    return placed;
  }

  function juceWindows(files) {
    const { classes, consts } = readJuce(files);
    if (!classes.size) return null;
    const held = new Set();
    for (const c of classes.values()) for (const mem of c.members.values()) if (classes.has(mem.type) && c.added.some(a => a.name === mem.name)) held.add(mem.type);
    // the windows: what the app opens (new …), an editor or a main component, or one that sets its own size; the
    // rest are inside these, or made when the program runs
    const free = [...classes.values()].filter(c => !held.has(c.name));
    let tops = free.filter(c => (c.content || c.size || /(?:^Main|Editor$|Window$)/.test(c.name)) && (c.added.length || c.size));
    if (!tops.length && free.length) tops = [free.sort((a, b) => b.added.length - a.added.length)[0]];
    const windows = [], notes = [];
    const unshown = free.filter(c => !tops.includes(c) && c.added.length);
    if (unshown.length) notes.push(`Not inside any window read here (they may be made when the program runs): ${unshown.map(c => c.name).join(', ')}.`);
    const build = (c, W, H, ox, oy, ids, stack) => {
      const placed = c.resized ? rectSteps(c.resized, W, H, consts) : new Map();
      const kids = [], seen = new Set();
      let flowX = 8, flowY = 8, rowH = 0;
      for (const add of c.added) {
        if (seen.has(add.name)) continue;
        seen.add(add.name);
        const mem = c.members.get(add.name);
        if (!mem) continue;   // (a local name, a loop's variable: made when the program runs)
        const type = mem.type, inner = classes.get(type), many = mem.many !== 1 || add.indexed;
        const p = placed.get(add.name);
        let how = 'sketch', box = null, why = null, kidsFirst = null;
        if (p && p.box && !many) { box = p.box; how = p.how; }
        else {
          let one = inner ? (inner.size || { w: 220, h: 160 }) : juceSize(type, mem.rotary, mem.vertical);
          if (inner && !inner.size && !stack.includes(inner.name) && inner.added.length) {
            const gw = Math.max(220, Math.min(W - 16, 420));
            kidsFirst = build(inner, gw, 10000, 0, 18, ids, [...stack, inner.name]);
            const bottom = kidsFirst.reduce((b, k) => Math.max(b, k.y + k.h), 18);
            one = { w: gw, h: bottom + 8 };
          }
          const want = many ? { w: Math.min(W - 16, one.w * 2 + 24), h: one.h + 18 } : one;
          if (flowX + want.w > W - 8 && flowX > 8) { flowX = 8; flowY += rowH + 8; rowH = 0; }
          box = { x: flowX, y: flowY, w: Math.min(want.w, W - 16), h: want.h };
          flowX += box.w + 8; rowH = Math.max(rowH, box.h);
          why = many ? `${add.name} is ${mem.many ? mem.many + ' of them' : 'a list'}, each placed when the program runs: shown as one group.`
            : p ? `Its place is worked out in resized() from what the program knows when it runs (${p.path}, line ${p.line + 1}), so it's shown in the order it's added.`
            : c.resized ? 'resized() doesn\'t place it by name, so it\'s shown in the order it\'s added.' : 'Nothing places it, so it\'s shown in the order it\'s added.';
        }
        let id = add.name.replace(/[^\w-]+/g, '-');
        for (let k = 2; ids.has(id); k++) id = `${add.name}-${k}`;
        ids.add(id);
        const src = [{ path: mem.path, line: mem.line, role: 'made' }, { path: add.path, line: add.line, role: 'shown' }];
        if (p) src.push({ path: p.path, line: p.line, role: 'placed' });
        for (const d of c.does) if (d.name === add.name) src.push({ path: d.path, line: d.line, role: 'does' });
        const node = { id, kind: inner ? 'frame' : (JUCE_KINDS[type] || 'frame'), type, name: add.name, label: mem.label || '', how, many: many ? (mem.many || true) : null,
          x: Math.round(ox + box.x), y: Math.round(oy + box.y), w: Math.round(box.w), h: Math.round(box.h),
          src: src.filter(x => x.path != null), place: p && !many ? (p.how === 'exact' ? 'bounds' : 'rect') : 'none', why, geom: p && !many ? p : null, children: [], hidden: add.hidden };
        if (kidsFirst) { const sx = Math.round(ox + box.x), sy = Math.round(oy + box.y); const move = (k) => { k.x += sx; k.y += sy; k.children.forEach(move); }; kidsFirst.forEach(move); node.children = kidsFirst; }
        else if (inner && !stack.includes(inner.name)) node.children = build(inner, box.w, box.h, ox + box.x, oy + box.y, ids, [...stack, inner.name]);
        kids.push(node);
      }
      return kids;
    };
    for (const c of tops) {
      const W = c.size ? c.size.w : 800, H = c.size ? c.size.h : 600, ids = new Set();
      const src = [...c.src]; if (c.size) src.push({ path: c.size.path, line: c.size.line, role: 'placed' });
      const node = { id: c.name, kind: 'window', type: c.name, name: c.name, label: c.name, how: c.size ? 'exact' : 'sketch', x: 0, y: 0, w: W, h: H, src, place: 'window', children: build(c, W, H, 0, 0, ids, [c.name]),
        why: c.size ? null : 'Its size is set when the program runs (not by setSize here), so it\'s shown at 800 × 600.' };
      windows.push({ title: c.name, toolkit: 'JUCE', path: (c.src[0] || {}).path, w: W, h: H, root: node });
    }
    return { windows, notes };
  }

  /* ---------- the estimate ---------- */

  function estimate(files) {
    const windows = [], notes = [], toolkits = new Set();
    for (const f of files.filter(f => /\.pyw?$/i.test(f.path))) {
      const r = readTk(f);
      if (!r) continue;
      toolkits.add('tkinter');
      const w = tkWindows(f, r);
      windows.push(...w.windows); notes.push(...w.notes);
    }
    // every C++ file, once any of them uses JUCE (a .cpp that defines what its .h declares needn't say juce itself)
    const cpp = files.filter(f => /\.(?:cpp|cc|cxx|h|hpp|hh)$/i.test(f.path));
    if (cpp.some(f => /\bjuce\b|JuceHeader/.test(f.code))) {
      const j = juceWindows(cpp);
      if (j && j.windows.length) { toolkits.add('JUCE'); windows.push(...j.windows); notes.push(...j.notes); }
    }
    return { toolkits: [...toolkits], windows, notes };
  }

  function flat(win) {
    const out = [];
    const walk = (n, parent) => { out.push({ node: n, parent }); for (const c of n.children) walk(c, n); };
    walk(win.root, null);
    return out;
  }

  /* A move of dx, dy: the line that places it, with new numbers. Only numbers written as numbers are changed: a
     position worked out by rules or by the program says why, and where it's placed. */
  function move(files, node, dx, dy, parent) {
    dx = Math.round(dx); dy = Math.round(dy);
    const g = node.geom, at = g ? ` (${(node.src.find(s => s.role === 'placed') || {}).path}, line ${g.line + 1})` : '';
    if (!dx && !dy) return { why: 'It wasn\'t moved.' };
    if (node.kind === 'window') return { why: 'A window is moved by whoever opens it; its size is in the code, its place on the screen isn\'t.' };
    if (!g) return { why: node.why || 'Nothing in the code places it.' };
    const file = files.find(f => f.path === (node.src.find(s => s.role === 'placed') || {}).path);
    if (!file) return { why: 'Its code isn\'t in the project.' };
    const lines = String(file.code).replace(/\r\n?/g, '\n').split('\n');
    const line = lines[g.line];
    if (node.place === 'place') {
      const xs = String(g.kw.x || '0').trim(), ys = String(g.kw.y || '0').trim();
      if (!/^-?\d+$/.test(xs) || !/^-?\d+$/.test(ys)) return { why: `place() works its position out (x=${xs}, y=${ys})${at}: change it there.` };
      const i = line.indexOf('.place(');
      if (i < 0) return { why: `place() is written over more than one line${at}: change its numbers there.` };
      const b = bracket(line, i + 6);
      if (!b) return { why: `place() is written over more than one line${at}: change its numbers there.` };
      const nx = +xs + dx, ny = +ys + dy;
      let inner = b.inner;
      inner = /\bx\s*=/.test(inner) ? inner.replace(/\bx\s*=\s*-?\d+/, `x=${nx}`) : `x=${nx}, ` + inner;
      inner = /\by\s*=/.test(inner) ? inner.replace(/\by\s*=\s*-?\d+/, `y=${ny}`) : inner.replace(/(x=-?\d+)/, `$1, y=${ny}`);
      return { path: file.path, line: g.line, text: line.slice(0, i + 7) + inner + line.slice(b.end), x: nx, y: ny };
    }
    if (node.place === 'bounds') {
      const m = line.match(/setBounds\s*\(\s*(-?\d+)\s*,\s*(-?\d+)\s*,/);
      if (!m) return { why: `setBounds() is written over more than one line${at}: change its numbers there.` };
      const nx = +m[1] + dx, ny = +m[2] + dy;
      return { path: file.path, line: g.line, text: line.replace(/setBounds\s*\(\s*-?\d+\s*,\s*-?\d+\s*,/, `setBounds(${nx}, ${ny},`), x: nx, y: ny };
    }
    if (node.place === 'grid' && parent && parent.grid) {
      // dropped in another cell of its grid: its row and column change (a cell that's taken says so)
      const { ox, oy, xs, ys } = parent.grid, cx = node.x + dx + node.w / 2 - ox, cy = node.y + dy + node.h / 2 - oy;
      // (just past the last row or column: a new one)
      const cell = (bounds, v) => (v < 0 ? 0 : v >= bounds[bounds.length - 1] ? bounds.length - 1 : Math.max(0, bounds.findIndex((b, i) => i < bounds.length - 1 && v >= b && v < bounds[i + 1])));
      const col = cell(xs, cx), row = cell(ys, cy);
      const was = node.cell;
      if (!was || (row === was.r && col === was.c)) return { why: 'It\'s still in the same cell of the grid: a grid places things by row and column, not by the pixel.' };
      const taken = parent.children.find(c => c !== node && c.cell && c.cell.r === row && c.cell.c === col);
      if (taken) return { why: `Row ${row}, column ${col} has ${taken.name || 'something'} in it already.` };
      const rs = String(g.kw.row ?? '0').trim(), cs = String(g.kw.column ?? '0').trim();
      if (!/^\d+$/.test(rs) || !/^\d+$/.test(cs)) return { why: `grid() works its row and column out${at}: change them there.` };
      const i = line.indexOf('.grid(');
      const b = i >= 0 && bracket(line, i + 5);
      if (!b) return { why: `grid() is written over more than one line${at}: change its row and column there.` };
      let inner = b.inner;
      inner = /\brow\s*=/.test(inner) ? inner.replace(/\brow\s*=\s*\d+/, `row=${row}`) : `row=${row}, ` + inner;
      inner = /\bcolumn\s*=/.test(inner) ? inner.replace(/\bcolumn\s*=\s*\d+/, `column=${col}`) : inner.replace(/(row=\d+)/, `$1, column=${col}`);
      return { path: file.path, line: g.line, text: line.slice(0, i + 6) + inner + line.slice(b.end), row, column: col };
    }
    if (node.place === 'pack') return { why: `pack() places things one after another (side=${(strOf(g.kw.side || '') || 'top')}), not at a position${at}. Change its order or side there, or place it with place(x=…, y=…).` };
    return { why: node.why || `Its position is worked out in the code${at}: change the numbers there.` };
  }


  /* ---------- measured: the running app's own report ---------- */

  /* The layout report (version 1), the same from every probe:
       { intuacode: 'layout', version: 1, toolkit, made (ISO time), windows: [{ title, w, h, picture?, root: Part }] }
       Part: { type (its class: Button, juce::Slider, fec::console::ConsolePage), name (the code's name for it, if the
               probe can tell), id, text, x, y, w, h (in its window), shown, children: [Part] }
     measured(report, est) draws it: each part where the app put it, linked to the estimate's part of the same name (or
     the same kind, in the same place among its group), so its code lights up, and one the code places with numbers still
     moves (as the code's part it stands for, eid). -> { toolkits, windows, notes, made } or null for something that isn't a report. */
  const shortType = (t) => String(t || '').replace(/<.*$/, '').split('::').pop();
  function measured(report, est) {
    if (!report || report.intuacode !== 'layout' || !Array.isArray(report.windows)) return null;
    const notes = [], windows = [], ewins = (est && est.windows) || [];
    const kindOf = (t) => { const s = shortType(t); return TK_KINDS[s] || JUCE_KINDS[s] || (/Component$|Page$|Panel$|View$|Bay$|Strip/.test(s) ? 'frame' : 'frame'); };
    // the estimate's children matched to the report's: by the code's name first, then by kind in order
    const pair = (rkids, ekids) => {
      const out = new Map(), used = new Set();
      for (const r of rkids) {
        const e = r.name && ekids.find(k => !used.has(k) && k.name === r.name);
        if (e) { out.set(r, e); used.add(e); }
      }
      // by kind, in order; a part the code makes several of (an array, a loop) stands for as many of the app's
      const byType = new Map();
      for (const r of rkids) if (!out.has(r)) { const t = shortType(r.type); if (!byType.has(t)) byType.set(t, []); byType.get(t).push(r); }
      for (const [t, rs] of byType) {
        const es = ekids.filter(k => !used.has(k) && shortType(k.type) === t);
        let i = 0;
        es.forEach((e, j) => {
          const after = es.length - j - 1;   // (each of the code's parts after it stands for one at least)
          const n = typeof e.many === 'number' ? e.many : e.many ? Math.max(1, rs.length - i - after) : 1;
          for (let k = 0; k < n && i < rs.length; k++) out.set(rs[i++], e);
          used.add(e);
        });
      }
      return out;
    };
    // each window matched to the estimate's by its title, then by its class (a JUCE window's title is its name; the
    // estimate's, its class), then what's left of each, in order
    const taken = new Set(), take = (e) => { if (e) taken.add(e); return e || null; };
    const wins = report.windows.map(rw => rw && rw.root ? take(ewins.find(w => !taken.has(w) && w.title === rw.title) || ewins.find(w => !taken.has(w) && w.root && w.root.type === shortType(rw.root.type))) : null);
    report.windows.forEach((rw, wi) => { if (rw && rw.root && !wins[wi]) wins[wi] = take(ewins.find(w => !taken.has(w))); });
    report.windows.forEach((rw, wi) => {
      if (!rw || !rw.root) return;
      const ew = wins[wi], ids = new Set();
      const build = (r, e) => {
        const base = String(r.name || (e && e.name) || shortType(r.type) || 'part').replace(/[^\w-]+/g, '-');
        let id = base;
        for (let k = 2; ids.has(id); k++) id = `${base}-${k}`;
        ids.add(id);
        const exact = e && e.how === 'exact' && e.kind !== 'window';
        const node = { id, kind: e && e.kind === 'window' ? 'window' : kindOf(r.type), type: shortType(r.type), name: r.name || (e && e.name) || null,
          label: r.text || (e && e.label) || r.name || '', how: 'measured', x: Math.round(+r.x || 0), y: Math.round(+r.y || 0), w: Math.round(+r.w || 0), h: Math.round(+r.h || 0),
          // (moved, it's the code's part it stands for that moves, eid: here its place is the app's)
          src: e ? e.src : [], place: 'none', geom: null, cell: null, many: null, children: [],
          estimate: e ? { x: e.x, y: e.y, w: e.w, h: e.h, how: e.how } : null, eid: e ? e.id : null,
          // (why it can't be moved here: the code's reason, as the estimate gives it)
          why: !e ? 'The code read here doesn\'t say where it\'s made.' : exact || e.kind === 'window' ? null
            : e.why || `In the code its place is ${e.how === 'rules' ? 'laid out by rules' : 'worked out when it runs'}.` };
        const kids = (r.children || []).filter(c => c && c.shown !== false), hidden = (r.children || []).filter(c => c && c.shown === false);
        for (const h of hidden) if (h.name) notes.push(`${h.name} (${shortType(h.type)}) is made but not shown in the running app.`);
        const matched = pair(kids, e ? e.children : []);
        node.children = kids.map(c => build(c, matched.get(c) || null));
        return node;
      };
      const root = build(rw.root, ew ? ew.root : null);
      root.kind = 'window';
      windows.push({ title: rw.title || (ew && ew.title) || 'window', toolkit: report.toolkit || (ew && ew.toolkit) || '', w: Math.round(+rw.w || root.w), h: Math.round(+rw.h || root.h), root, picture: rw.picture || null, measured: true });
    });
    if (report.note) notes.push(String(report.note));
    return { toolkits: [report.toolkit || ''], windows, notes, made: report.made || null, measured: true };
  }
  /* The report a probe printed: the JSON between its two marks. -> the report, or null. */
  const MARK = '\u0001INTUACODE-LAYOUT\u0001';
  function reportIn(text) {
    const parts = String(text || '').split(MARK);
    if (parts.length < 3) return null;
    try { return JSON.parse(parts[1]); } catch (e) { return null; }
  }

  /* The probes, as files IntuaCode writes out: tkinter's runs the program (the desktop app does it), JUCE's goes in the
     app (it writes its report when the app runs with INTUACODE_LAYOUT set). */
  const TK_PROBE = "\"\"\"IntuaCode's layout probe for tkinter: runs the program, and once its window is up, reports where every widget is\n(as Tk placed it), then closes it. The window is put out of sight while it's measured. Usage:\n    python -u probe_tk.py main.py [its arguments]\nIt prints one line, between two marks, of JSON: IntuaCode's layout report (version 1). A program that never opens a\nwindow, or hangs, is ended after 25 seconds (INTUACODE_PROBE_TIMEOUT), saying where it was on stderr.\"\"\"\nimport faulthandler, os, sys\n# (first, and a thread of C's: it ends the program even while Tk, or a loop, holds Python's lock)\nfaulthandler.dump_traceback_later(float(os.environ.get('INTUACODE_PROBE_TIMEOUT') or 25), exit=True)\nimport json, runpy, time, types\nimport tkinter\n\nMARK = '\\x01INTUACODE-LAYOUT\\x01'\n\n\ndef names_in_program():\n    \"\"\"The program's own names for its widgets: module names (status), and an object's (self.status).\"\"\"\n    found = {}\n    scope = vars(sys.modules.get('__main__')) if sys.modules.get('__main__') else {}\n    for key, value in list(scope.items()):   # its own names first (window), then an object's (self.status)\n        if isinstance(value, tkinter.Misc):\n            found.setdefault(str(value), key)\n    for key, value in list(scope.items()):\n        if not isinstance(value, (type, types.ModuleType)) and not isinstance(value, tkinter.Misc) and hasattr(value, '__dict__') and not callable(value):\n            try:\n                for k2, v2 in list(vars(value).items()):\n                    if isinstance(v2, tkinter.Misc):\n                        found.setdefault(str(v2), k2)\n            except TypeError:\n                pass\n    return found\n\n\ndef report(root):\n    root.update_idletasks()\n    root.update()\n    names = names_in_program()\n\n    def node(w, ox, oy):\n        try:\n            text = w.cget('text')\n        except (tkinter.TclError, AttributeError):\n            text = ''\n        kind = w.winfo_class()\n        return {\n            'type': kind[1:] if kind.startswith('T') and kind[1:2].isupper() else kind,   # (ttk's TButton is a Button)\n            'name': names.get(str(w)), 'id': str(w), 'text': str(text) if text is not None else '',\n            'x': w.winfo_rootx() - ox, 'y': w.winfo_rooty() - oy, 'w': w.winfo_width(), 'h': w.winfo_height(),\n            'shown': bool(w.winfo_ismapped()), 'manager': w.winfo_manager(),\n            'children': [node(c, ox, oy) for c in w.winfo_children() if not isinstance(c, tkinter.Menu)],\n        }\n\n    tops = [root] + [w for w in root.winfo_children() if isinstance(w, tkinter.Toplevel)]\n    windows = []\n    for top in tops:\n        ox, oy = top.winfo_rootx(), top.winfo_rooty()\n        n = node(top, ox, oy)\n        windows.append({'title': top.title(), 'w': n['w'], 'h': n['h'], 'picture': None, 'root': n})\n    data = {'intuacode': 'layout', 'version': 1, 'toolkit': 'tkinter', 'made': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),\n            'windows': windows}\n    sys.stdout.write(MARK + json.dumps(data) + MARK + '\\n')\n    sys.stdout.flush()\n    os._exit(0)\n\n\n_mainloop = tkinter.Misc.mainloop\n\n\ndef mainloop(self, n=0):\n    root = self._root()\n    try:\n        root.attributes('-alpha', 0.0)          # (out of sight where the system lets it be)\n    except tkinter.TclError:\n        pass\n    root.geometry('+-20000+-20000')             # (and off the screen: its size stays the program's)\n    root.after(500, lambda: report(root))\n    _mainloop(self, n)\n\n\ntkinter.Misc.mainloop = mainloop\ntkinter.mainloop = lambda n=0: mainloop(tkinter._get_default_root('mainloop') if hasattr(tkinter, '_get_default_root') else tkinter._default_root, n)\nif len(sys.argv) < 2:\n    sys.exit('usage: probe_tk.py program.py')\nsys.argv = sys.argv[1:]\nsys.path.insert(0, os.path.dirname(os.path.abspath(sys.argv[0])))\nrunpy.run_path(sys.argv[0], run_name='__main__')\nsys.stdout.write(MARK + json.dumps({'intuacode': 'layout', 'version': 1, 'toolkit': 'tkinter', 'windows': [], 'note': 'The program ended without opening a window (no mainloop).'}) + MARK + '\\n')\nsys.stdout.flush()\nos._exit(0)\n";
  const JUCE_PROBE = "#pragma once\n// IntuaCode's layout probe for JUCE. When the app runs with INTUACODE_LAYOUT set to a file's path, a moment after its\n// window shows it writes where every component is to that file, as IntuaCode's layout report (version 1), with a\n// picture of each window beside it; IntuaCode's Preview then draws the app as it really is. Nothing happens, and nothing\n// is written, unless INTUACODE_LAYOUT is set.\n//\n//   1. #include \"IntuaCodeProbe.h\" in the file that makes the main window, and after the window is made and shown:\n//          intuacode::probeLayoutSoon();\n//   2. Run the app with INTUACODE_LAYOUT=<the project's folder>/intuacode-layout.json\n//      (and INTUACODE_LAYOUT_QUIT=1 to close it once it has written the report).\n//   3. In IntuaCode, press Measure in the Preview.\n// An app that saves its state when it quits can skip that for a run that's only measured: quitsAfterMeasuring().\n#include <juce_gui_basics/juce_gui_basics.h>\n#include <cstring>\n#include <memory>\n#include <typeinfo>\n#if defined(__GNUG__)\n #include <cxxabi.h>\n #include <cstdlib>\n#endif\n\nnamespace intuacode {\n\n// a component's class, as written in the code (fec::console::ConsolePage, juce::Slider)\ninline juce::String typeNameOf(const juce::Component& c) {\n    const char* raw = typeid(c).name();\n   #if defined(__GNUG__)\n    int status = 0;\n    std::unique_ptr<char, void (*)(void*)> plain(abi::__cxa_demangle(raw, nullptr, nullptr, &status), std::free);\n    return status == 0 && plain != nullptr ? juce::String(plain.get()) : juce::String(raw);\n   #else\n    juce::String s(raw);   // MSVC: \"class fec::console::ConsolePage\"\n    for (auto word : { \"class \", \"struct \" })\n        if (s.startsWith(word)) return s.substring((int) std::strlen(word));\n    return s;\n   #endif\n}\n\ninline juce::var describe(juce::Component& c, juce::Component& window) {\n    auto* o = new juce::DynamicObject();\n    const auto r = window.getLocalArea(&c, c.getLocalBounds());\n    juce::String text;\n    if (auto* b = dynamic_cast<juce::Button*>(&c)) text = b->getButtonText();\n    else if (auto* l = dynamic_cast<juce::Label*>(&c)) text = l->getText();\n    o->setProperty(\"type\", typeNameOf(c));\n    o->setProperty(\"name\", c.getName());\n    o->setProperty(\"id\", c.getComponentID());\n    o->setProperty(\"text\", text);\n    o->setProperty(\"x\", r.getX());\n    o->setProperty(\"y\", r.getY());\n    o->setProperty(\"w\", r.getWidth());\n    o->setProperty(\"h\", r.getHeight());\n    o->setProperty(\"shown\", c.isShowing());\n    juce::Array<juce::var> children;\n    for (auto* child : c.getChildren())\n        children.add(describe(*child, window));\n    o->setProperty(\"children\", children);\n    return juce::var(o);\n}\n\n// Every window on the screen: where each component is, in the window, and a picture of it beside the report.\ninline void writeLayout(const juce::File& report) {\n    juce::Array<juce::var> windows;\n    auto& desktop = juce::Desktop::getInstance();\n    for (int i = 0; i < desktop.getNumComponents(); ++i) {\n        auto* top = desktop.getComponent(i);\n        if (top == nullptr || !top->isShowing()) continue;\n        juce::Component* content = top;\n        if (auto* rw = dynamic_cast<juce::ResizableWindow*>(top))\n            if (auto* cc = rw->getContentComponent()) content = cc;\n        auto* w = new juce::DynamicObject();\n        w->setProperty(\"title\", top->getName());\n        w->setProperty(\"w\", content->getWidth());\n        w->setProperty(\"h\", content->getHeight());\n        const auto picture = report.getSiblingFile(report.getFileNameWithoutExtension() + \"-\" + juce::String(i) + \".png\");\n        const auto image = content->createComponentSnapshot(content->getLocalBounds(), true, 1.0f);\n        picture.deleteFile();\n        if (auto stream = picture.createOutputStream()) {\n            juce::PNGImageFormat png;\n            if (png.writeImageToStream(image, *stream)) w->setProperty(\"picture\", picture.getFileName());\n        }\n        w->setProperty(\"root\", describe(*content, *content));\n        windows.add(juce::var(w));\n    }\n    auto* o = new juce::DynamicObject();\n    o->setProperty(\"intuacode\", \"layout\");\n    o->setProperty(\"version\", 1);\n    o->setProperty(\"toolkit\", \"JUCE\");\n    o->setProperty(\"made\", juce::Time::getCurrentTime().toISO8601(true));\n    o->setProperty(\"windows\", windows);\n    report.replaceWithText(juce::JSON::toString(juce::var(o)));\n}\n\n// This run is only to be measured: it writes the report and quits (INTUACODE_LAYOUT and INTUACODE_LAYOUT_QUIT set).\ninline bool quitsAfterMeasuring() {\n    return juce::SystemStats::getEnvironmentVariable(\"INTUACODE_LAYOUT\", {}).isNotEmpty()\n        && juce::SystemStats::getEnvironmentVariable(\"INTUACODE_LAYOUT_QUIT\", {}).isNotEmpty();\n}\n\n// After the main window is made: measures it a moment later (when it's laid out), if INTUACODE_LAYOUT is set.\ninline void probeLayoutSoon(int afterMs = 1500) {\n    const auto path = juce::SystemStats::getEnvironmentVariable(\"INTUACODE_LAYOUT\", {});\n    if (path.isEmpty()) return;\n    juce::Timer::callAfterDelay(afterMs, [path] {\n        writeLayout(juce::File(path));\n        if (quitsAfterMeasuring())\n            juce::JUCEApplicationBase::quit();\n    });\n}\n\n} // namespace intuacode\n";

  const api = { estimate, flat, move, num, statements, splitArgs, readJuce, measured, reportIn, MARK, TK_PROBE, JUCE_PROBE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.IntuiGui = api;
})(typeof window !== 'undefined' ? window : globalThis);

/* IntuaCode — the GUI estimate's other toolkits: Qt (PySide and PyQt in Python, Widgets in C++), wxPython, and Dear
 * ImGui (C++). Each is read from the code into windows of parts the same shape as lang/gui.js's (tkinter, JUCE), each
 * part exact (the code says the numbers), laid out by rules (a layout or sizer followed, the sizes estimated) or a
 * sketch, with the lines that make, place and wire it; and the lines a drag or a corner rewrites, where the code says
 * the numbers. Their probes (for Measure) are here too.
 *
 *   IntuiGui.kits: [{ name, test(files), estimate(files) -> { windows, notes }, places: [place kinds], move(...), resize(...),
 *                    KINDS: { class: kind }, probe: { kind: 'python' | 'header', file, text } }]
 *
 * No page here: the app and the tests both use it, after lang/gui.js.
 */
(function (root) {
  'use strict';
  const G = root.IntuiGui;
  if (!G || !G.parts) return;
  const { statements, splitArgs, bracket, args, strOf, num, blankComments } = G.parts;
  const CH = 6, LH = 16;   // a character's width and a line's height, roughly, in the system's UI font (Segoe UI 9pt)
  const textW = (t) => Math.max(...String(t || '').split('\n').map(l => l.length)) * CH;
  const linesOf = (code) => String(code).replace(/\r\n?/g, '\n').split('\n');
  /* C++ statement by statement (comments blanked first): split at ; { and } outside brackets and strings, each with
     the line it starts on; # lines (the preprocessor's) left out. (lang/gui.js's statements keep a brace's body whole.) */
  function cppStatements(code) {
    const out = [], src = String(code).replace(/\r\n?/g, '\n');
    let cur = '', start = -1, depth = 0, q = null, line = 0;
    const push = () => { const t = cur.trim(); if (t && !t.startsWith('#')) out.push({ text: t.replace(/\s+/g, ' '), line: start }); cur = ''; start = -1; };
    for (let i = 0; i < src.length; i++) {
      const c = src[i];
      if (c === '\n') { if (!q && cur.trim().startsWith('#')) { push(); line++; continue; } line++; }
      if (start < 0 && /\S/.test(c)) start = line;
      if (q) { cur += c; if (c === '\\') { cur += src[++i] || ''; } else if (c === q) q = null; continue; }
      if (c === '"' || c === "'") { q = c; cur += c; continue; }
      if (c === '(' || c === '[') depth++;
      if (c === ')' || c === ']') depth = Math.max(0, depth - 1);
      if (depth === 0 && (c === ';' || c === '{' || c === '}')) { push(); continue; }
      cur += c;
    }
    push();
    return out;
  }
  const pair = (s) => { const m = String(s || '').match(/^\(?\s*(-?\d+)\s*,\s*(-?\d+)\s*\)?$/); return m ? [+m[1], +m[2]] : null; };
  const ids = () => { const used = new Set(); return (base) => { const b = String(base || 'part').replace(/[^\w-]+/g, '-'); let id = b; for (let k = 2; used.has(id); k++) id = `${b}-${k}`; used.add(id); return id; }; };
  // the text a Qt or wx call is given: "…", tr("…"), QStringLiteral("…"), QString("…"), _("…")
  const textArg = (a) => {
    const s = String(a || '').trim(), w = s.match(/^(?:tr|QStringLiteral|QString|QObject::tr|_|u8)\s*\((.*)\)$/s);
    return strOf(w ? w[1] : s);
  };
  // the line, with one call's bracket's inside replaced: -> the line, or null when the call isn't on it
  const withInside = (line, call, fn) => {
    const i = line.search(new RegExp(`\\b${call}\\s*\\(`));
    if (i < 0) return null;
    const open = line.indexOf('(', i), b = bracket(line, open);
    if (!b) return null;
    const inner = fn(b.inner);
    return inner == null ? null : line.slice(0, open + 1) + inner + line.slice(b.end);
  };

  /* ------------------------------------------------------------------ */
  /* Qt: PySide and PyQt (Python), and Widgets (C++)                     */
  /* ------------------------------------------------------------------ */

  const QT_KINDS = { QPushButton: 'button', QToolButton: 'button', QCommandLinkButton: 'button', QLabel: 'label', QLineEdit: 'entry', QTextEdit: 'text', QPlainTextEdit: 'text',
    QTextBrowser: 'text', QListWidget: 'list', QListView: 'list', QTreeWidget: 'list', QTreeView: 'list', QTableWidget: 'list', QTableView: 'list', QCheckBox: 'check',
    QRadioButton: 'check', QComboBox: 'choice', QFontComboBox: 'choice', QSpinBox: 'entry', QDoubleSpinBox: 'entry', QDateEdit: 'entry', QTimeEdit: 'entry', QSlider: 'slider',
    QDial: 'slider', QScrollBar: 'slider', QProgressBar: 'progress', QGroupBox: 'frame', QFrame: 'frame', QWidget: 'frame', QTabWidget: 'frame', QScrollArea: 'frame',
    QStackedWidget: 'frame', QSplitter: 'frame', QGraphicsView: 'canvas', QOpenGLWidget: 'canvas', QCalendarWidget: 'frame', QLCDNumber: 'label', QMainWindow: 'window', QDialog: 'window' };
  const QT_LAYOUTS = { QVBoxLayout: 'V', QHBoxLayout: 'H', QGridLayout: 'G', QFormLayout: 'F' };
  const QT_WINDOWS = /^(?:QWidget|QMainWindow|QDialog)$/;
  // how a widget takes more room than it asks for: E grows first, P (Preferred, Minimum) after, F not
  const QT_GROW_H = (t) => (/^(?:QLineEdit|QTextEdit|QPlainTextEdit|QTextBrowser|QList|QTree|QTable|QSlider|QProgressBar|QScrollBar|QGraphicsView|QTabWidget|QScrollArea|QStackedWidget|QSplitter|QCalendarWidget|QOpenGLWidget|QFontComboBox)/.test(t) ? 'E' : 'P');
  const QT_GROW_V = (t) => (/^(?:QTextEdit|QPlainTextEdit|QTextBrowser|QList|QTree|QTable|QGraphicsView|QTabWidget|QScrollArea|QStackedWidget|QSplitter|QCalendarWidget|QOpenGLWidget)/.test(t) ? 'E'
    : /^(?:QLabel|QWidget|QFrame|QGroupBox|QDial|QLCDNumber)$/.test(t) ? 'P' : 'F');
  // (sizes as the probe measured them: PySide6 in Windows 11's style)
  function qtHint(w) {
    const t = w.type, tw = textW(w.text);
    switch (t) {
      case 'QPushButton': return { w: Math.max(81, tw + 24), h: 26 };
      case 'QToolButton': return { w: Math.max(26, tw + 12), h: 26 };
      case 'QCommandLinkButton': return { w: Math.max(120, tw + 40), h: 41 };
      case 'QLabel': case 'QLCDNumber': return { w: Math.max(tw, 1), h: LH * Math.max(1, String(w.text || '').split('\n').length) };
      case 'QLineEdit': return { w: 133, h: 26 };
      case 'QCheckBox': case 'QRadioButton': return { w: tw + 39, h: 24 };
      case 'QComboBox': case 'QFontComboBox': return { w: 100, h: 26 };
      case 'QSpinBox': case 'QDoubleSpinBox': case 'QDateEdit': case 'QTimeEdit': return { w: 60, h: 26 };
      case 'QSlider': case 'QScrollBar': return w.vertical ? { w: 16, h: 84 } : { w: 84, h: 16 };
      case 'QDial': return { w: 50, h: 50 };
      case 'QProgressBar': return { w: 120, h: 24 };
      case 'QTabWidget': return { w: 200, h: 150 };
      case 'QCalendarWidget': return { w: 280, h: 190 };
      default: return /^(?:QTextEdit|QPlainTextEdit|QTextBrowser|QList|QTree|QTable|QGraphicsView|QScrollArea|QOpenGLWidget)/.test(t) ? { w: 256, h: 192 } : { w: 0, h: 0 };
    }
  }

  /* Read: the widgets made, their parents and text, the layouts and what's in them, geometry, titles, sizes, and the
     signals wired. lang: 'python' | 'cpp'. -> { widgets, layouts, classes } or null when the file doesn't use Qt */
  function readQt(file, lang) {
    const code = lang === 'cpp' ? blankComments(file.code) : String(file.code);
    if (lang === 'python' ? !/\b(?:PySide[26]|PyQt[56])\b/.test(code) : !/\bQ(?:Widget|MainWindow|Dialog|PushButton|Label|VBoxLayout|HBoxLayout|GridLayout|Application)\b/.test(code)) return null;
    const raw = linesOf(file.code), st = lang === 'python' ? statements(code, 'py') : cppStatements(code), widgets = new Map(), layouts = new Map(), classes = new Map(), notes = [];
    let cls = null;   // the window class the code is in (Python: by indentation; C++: its constructor, or its body)
    const indent = (line) => (raw[line] || '').match(/^\s*/)[0].length;
    const src = (line, role) => ({ path: file.path, line, role });
    const nameOf = (s) => String(s || '').trim().replace(/^(?:self\.|this->|m_?(?=[a-z]))?/, (m) => (m === 'm_' || m === 'm' ? m : '')).replace(/^(?:self\.|this->)/, '');
    const key = (s) => { const n = String(s || '').trim().replace(/^(?:self\.|this->)/, ''); return n === 'self' || n === 'this' || n === '' ? (cls ? '@' + cls : null) : n; };
    const widget = (name, type, line) => {
      const w = { name, type, kind: QT_KINDS[type] || 'frame', text: null, parent: null, layout: null, geom: null, size: null, fixed: null, vertical: false, title: null, central: null, src: [src(line, 'made')], window: false, cls: null };
      widgets.set(name, w); return w;
    };
    for (const s of st) {
      const t = s.text.replace(/;$/, '').trim();
      let m;
      // a window class: class Main(QWidget) / class Main : public QMainWindow
      if ((m = t.match(lang === 'python' ? /^class\s+(\w+)\s*\(\s*(?:QtWidgets\.)?(QWidget|QMainWindow|QDialog)\s*\)\s*:?$/ : /^class\s+(\w+)\s*(?:final\s*)?:\s*public\s+(QWidget|QMainWindow|QDialog)\b/))) {
        cls = m[1];
        const w = widget('@' + cls, m[2], s.line);
        w.window = true; w.cls = cls; w.title = cls; classes.set(cls, w);
        continue;
      }
      if (lang === 'python') { if (cls && indent(s.line) === 0 && !/^(?:class|def|@)/.test(t)) cls = null; }
      else if ((m = t.match(/^(\w+)::\1\s*\(/)) && classes.has(m[1])) cls = m[1];
      // made: name = QPushButton("Add", self) / auto *name = new QPushButton(tr("Add"), this)
      const made = lang === 'python' ? t.match(/^((?:self\.)?\w+)\s*=\s*(?:QtWidgets\.|QtGui\.)?(Q\w+)\s*\(([\s\S]*)\)$/)
        : t.match(/^(?:(?:auto|Q\w+)\s*\*?\s*)?((?:this->)?\w+)\s*=\s*new\s+(Q\w+)\s*\(([\s\S]*)\)$/) || t.match(/^(Q\w+)\s+(\w+)\s*\(([\s\S]*)\)$/) && (() => { const q = t.match(/^(Q\w+)\s+(\w+)\s*\(([\s\S]*)\)$/); return [q[0], q[2], q[1], q[3]]; })();
      if (made && (QT_KINDS[made[2]] || QT_LAYOUTS[made[2]])) {
        const name = key(made[1]), a = args(made[3]);
        if (QT_LAYOUTS[made[2]]) {
          const L = { name, type: QT_LAYOUTS[made[2]], items: [], margins: null, spacing: null, line: s.line, owner: null };
          layouts.set(name, L);
          const parent = a.pos[0] && key(a.pos[0]);
          if (parent && (widgets.has(parent) || parent.startsWith('@'))) { L.owner = parent; (widgets.get(parent) || {}).layout = name; }
          continue;
        }
        const w = widget(name, made[2], s.line);
        for (const v of a.pos) {
          const tx = textArg(v);
          if (tx != null && w.text == null) w.text = tx;
          else if (/Qt(?:Core)?\.?(?:::)?(?:Orientation\.)?Vertical/.test(v)) w.vertical = true;
          else if (key(v) && (widgets.has(key(v)) || key(v).startsWith('@'))) w.parent = key(v);
        }
        if (a.kw.parent && key(a.kw.parent)) w.parent = key(a.kw.parent);
        if (a.kw.text) w.text = textArg(a.kw.text);
        if (QT_WINDOWS.test(made[2]) && !w.parent && !cls) { w.window = true; w.title = name; }
        continue;
      }
      // an instance of a window class: win = Main() / Main win;
      if ((m = lang === 'python' ? t.match(/^(\w+)\s*=\s*(\w+)\s*\(\s*\)$/) : t.match(/^(\w+)\s+(\w+)\s*;?$/)) && classes.has(lang === 'python' ? m[2] : m[1])) continue;
      // calls: name.addWidget(…), self.setWindowTitle(…), layout->addLayout(…), setLayout(…) (in a class), connect(…)
      const call = t.match(/^(?:if\s*\(\s*)?((?:self\.|this->)?[\w]+)?\s*(?:\.|->)?\s*(addWidget|addLayout|addStretch|addSpacing|addRow|setLayout|setContentsMargins|setSpacing|setGeometry|move|resize|setFixedSize|setFixedWidth|setFixedHeight|setWindowTitle|setCentralWidget|setText|setOrientation)\s*\(([\s\S]*)\)$/);
      if (call) {
        const who = call[1] ? key(call[1]) : (cls ? '@' + cls : null), fn = call[2], a = args(call[3]), n = (v) => num(v);
        const L = layouts.get(who), w = widgets.get(who);
        if (L) {
          if (fn === 'addWidget' || fn === 'addLayout') {
            const it = { what: fn === 'addWidget' ? 'widget' : 'layout', name: key(a.pos[0]), line: s.line, stretch: 0 };
            if (L.type === 'G') { it.row = n(a.pos[1]) ?? 0; it.col = n(a.pos[2]) ?? 0; it.rowspan = n(a.pos[3]) ?? 1; it.colspan = n(a.pos[4]) ?? 1; }
            else it.stretch = n(a.pos[1]) ?? 0;
            L.items.push(it);
            const c = widgets.get(it.name);
            if (c) c.src.push(src(s.line, 'placed'));
            if (c && !c.inLayout) c.inLayout = L.name;
            if (it.what === 'layout' && layouts.has(it.name)) layouts.get(it.name).nested = true;
          } else if (fn === 'addStretch') L.items.push({ what: 'stretch', stretch: n(a.pos[0]) ?? 1 });
          else if (fn === 'addSpacing') L.items.push({ what: 'space', size: n(a.pos[0]) ?? 0 });
          else if (fn === 'addRow') {
            const label = a.pos.length > 1 ? textArg(a.pos[0]) : null, field = key(a.pos[a.pos.length - 1]);
            L.items.push({ what: layouts.has(field) ? 'layout' : 'widget', name: field, label, line: s.line });
            const c = widgets.get(field);
            if (c) { c.src.push(src(s.line, 'placed')); c.inLayout = L.name; }
          } else if (fn === 'setContentsMargins') { const v = a.pos.map(n); if (v.length === 4 && v.every(x => x != null)) L.margins = v; }
          else if (fn === 'setSpacing') L.spacing = n(a.pos[0]);
          continue;
        }
        if (fn === 'setLayout' && w) { const ln = key(a.pos[0]); w.layout = ln; if (layouts.has(ln)) layouts.get(ln).owner = who; continue; }
        if (fn === 'setCentralWidget' && w) { w.central = key(a.pos[0]); const c = widgets.get(w.central); if (c) { c.parent = who; c.src.push(src(s.line, 'placed')); } continue; }
        if (fn === 'setWindowTitle' && w) { const tx = textArg(a.pos[0]); if (tx != null) w.title = tx; continue; }
        if (fn === 'setText' && w) { const tx = textArg(a.pos[0]); if (tx != null) w.text = tx; continue; }
        if (fn === 'setOrientation' && w) { w.vertical = /Vertical/.test(call[3]); continue; }
        if (w && (fn === 'setGeometry' || fn === 'move')) {
          const v = a.pos.map(n);
          w.geom = { how: fn, line: s.line, x: v[0], y: v[1], w: fn === 'setGeometry' ? v[2] : null, h: fn === 'setGeometry' ? v[3] : null, literal: a.pos.every(p => /^-?\d+$/.test(p.trim())) && a.pos.length === (fn === 'setGeometry' ? 4 : 2) };
          w.src.push(src(s.line, 'placed'));
          continue;
        }
        if (w && (fn === 'resize' || fn === 'setFixedSize')) {
          const v = a.pos.map(n);
          w.size = { line: s.line, w: v[0], h: v[1], literal: a.pos.length === 2 && a.pos.every(p => /^\d+$/.test(p.trim())), fixed: fn === 'setFixedSize' };
          if (w.window) w.src.push(src(s.line, 'placed'));
          continue;
        }
        if (w && fn === 'setFixedWidth') { w.fixed = { ...(w.fixed || {}), w: n(a.pos[0]) }; continue; }
        if (w && fn === 'setFixedHeight') { w.fixed = { ...(w.fixed || {}), h: n(a.pos[0]) }; continue; }
      }
      // wired: btn.clicked.connect(self.add) / connect(btn, &QPushButton::clicked, …)
      if ((m = t.match(/^((?:self\.)?\w+)\.(\w+)\.connect\s*\(/)) && widgets.has(key(m[1]))) { widgets.get(key(m[1])).src.push(src(s.line, 'does')); continue; }
      if ((m = t.match(/^(?:QObject::)?connect\s*\(\s*((?:this->)?\w+)\s*,/)) && widgets.has(key(m[1]))) { widgets.get(key(m[1])).src.push(src(s.line, 'does')); continue; }
    }
    if (![...widgets.values()].some(w => w.window)) return null;
    return { widgets, layouts, classes, notes };
  }

  /* Each layout's hint: what its items ask for, with its margins and spacing. */
  const qtMargins = (L) => L.margins || (L.nested ? [0, 0, 0, 0] : [11, 11, 11, 11]);
  const qtSpacing = (L) => (L.spacing != null ? L.spacing : 6);
  function qtWidgetHint(r, w) {
    if (w.fixed && w.fixed.w != null && w.fixed.h != null) return { w: w.fixed.w, h: w.fixed.h };
    let h = qtHint(w);
    if (w.layout && r.layouts.has(w.layout)) {
      const lh = qtLayoutHint(r, r.layouts.get(w.layout));
      h = { w: Math.max(h.w, lh.w), h: Math.max(h.h, lh.h + (w.type === 'QGroupBox' ? LH : 0)) };
    }
    if (w.size && w.size.fixed && w.size.w != null) h = { w: w.size.w, h: w.size.h };
    if (w.fixed) h = { w: w.fixed.w ?? h.w, h: w.fixed.h ?? h.h };
    return h;
  }
  function qtItemHint(r, it) {
    if (it.what === 'widget') { const w = r.widgets.get(it.name); return w ? qtWidgetHint(r, w) : { w: 0, h: 0 }; }
    if (it.what === 'layout') { const L = r.layouts.get(it.name); return L ? qtLayoutHint(r, L) : { w: 0, h: 0 }; }
    if (it.what === 'space') return { w: it.size, h: it.size };
    return { w: 0, h: 0 };
  }
  function qtLayoutHint(r, L) {
    const [ml, mt, mr, mb] = qtMargins(L), sp = qtSpacing(L), items = L.items.filter(i => i.what !== 'stretch');
    const hs = items.map(i => qtItemHint(r, i));
    if (L.type === 'V') return { w: Math.max(0, ...hs.map(h => h.w)) + ml + mr, h: hs.reduce((a, h) => a + h.h, 0) + sp * Math.max(0, items.length - 1) + mt + mb };
    if (L.type === 'H') return { w: hs.reduce((a, h) => a + h.w, 0) + sp * Math.max(0, items.length - 1) + ml + mr, h: Math.max(0, ...hs.map(h => h.h)) + mt + mb };
    if (L.type === 'F') {
      const lw = Math.max(0, ...L.items.map(i => textW(i.label))), rows = L.items.map((i, k) => Math.max(hs[k] ? hs[k].h : 0, i.label != null ? LH : 0));
      return { w: lw + sp + Math.max(0, ...hs.map(h => h.w)) + ml + mr, h: rows.reduce((a, b) => a + b, 0) + sp * Math.max(0, rows.length - 1) + mt + mb };
    }
    const g = qtGrid(r, L);
    return { w: g.cw.reduce((a, b) => a + b, 0) + sp * Math.max(0, g.cw.length - 1) + ml + mr, h: g.rh.reduce((a, b) => a + b, 0) + sp * Math.max(0, g.rh.length - 1) + mt + mb };
  }
  function qtGrid(r, L) {
    const cells = L.items.filter(i => i.what === 'widget' || i.what === 'layout');
    const cols = Math.max(1, ...cells.map(i => (i.col ?? 0) + (i.colspan ?? 1))), rows = Math.max(1, ...cells.map(i => (i.row ?? 0) + (i.rowspan ?? 1)));
    const cw = Array(cols).fill(0), rh = Array(rows).fill(0);
    for (const i of cells) { const h = qtItemHint(r, i); if ((i.colspan ?? 1) === 1) cw[i.col ?? 0] = Math.max(cw[i.col ?? 0], h.w); if ((i.rowspan ?? 1) === 1) rh[i.row ?? 0] = Math.max(rh[i.row ?? 0], h.h); }
    return { cells, cw, rh };
  }
  // share `extra` among items by their growth: stretch first, then E, then P; none: slots (each its share, centred)
  function share(extra, items) {
    const add = items.map(() => 0);
    if (extra <= 0 || !items.length) return { add, slot: false };
    const st = items.map(i => i.stretch || 0), total = st.reduce((a, b) => a + b, 0);
    if (total > 0) { items.forEach((i, k) => { add[k] = extra * st[k] / total; }); return { add, slot: false }; }
    for (const g of ['E', 'P']) {
      const ks = items.map((i, k) => (i.grow === g ? k : -1)).filter(k => k >= 0);
      if (ks.length) { for (const k of ks) add[k] = extra / ks.length; return { add, slot: false }; }
    }
    items.forEach((i, k) => { add[k] = extra / items.length; });
    return { add, slot: true };
  }
  /* Arrange a layout's items in a rectangle: each widget gets its box (x, y, w, h). */
  function qtArrange(r, L, x, y, W, H) {
    const [ml, mt, mr, mb] = qtMargins(L), sp = qtSpacing(L);
    x += ml; y += mt; W -= ml + mr; H -= mt + mb;
    const place = (it, bx, by, bw, bh) => {
      if (it.what === 'widget') { const w = r.widgets.get(it.name); if (w) qtPlace(r, w, bx, by, bw, bh, 'layout'); }
      else if (it.what === 'layout' && r.layouts.has(it.name)) qtArrange(r, r.layouts.get(it.name), bx, by, bw, bh);
    };
    const growOf = (it, along) => {
      if (it.what === 'stretch') return 'E';
      if (it.what === 'layout') return 'P';
      if (it.what !== 'widget') return 'F';
      const w = r.widgets.get(it.name);
      if (!w) return 'F';
      if (w.fixed && (along === 'V' ? w.fixed.h : w.fixed.w) != null) return 'F';
      return along === 'V' ? QT_GROW_V(w.type) : QT_GROW_H(w.type);
    };
    if (L.type === 'V' || L.type === 'H') {
      const v = L.type === 'V', items = L.items, hs = items.map(i => qtItemHint(r, i));
      const free = (v ? H : W) - sp * Math.max(0, items.filter(i => i.what !== 'stretch').length - 1) - hs.reduce((a, h) => a + (v ? h.h : h.w), 0);
      const sh = share(free, items.map(i => ({ stretch: i.what === 'stretch' ? i.stretch : i.stretch, grow: growOf(i, L.type) })));
      let at = v ? y : x, first = true;
      items.forEach((it, k) => {
        if (it.what === 'stretch') { at += sh.add[k]; return; }
        if (!first) at += sp;
        first = false;
        const len = (v ? hs[k].h : hs[k].w) + sh.add[k];
        // across: the whole width (V) or height (H), unless it keeps its height (a button in a row: centred)
        const crossGrow = growOf(it, v ? 'H' : 'V') !== 'F' || it.what === 'layout';
        const cross = v ? (crossGrow ? W : hs[k].w) : (crossGrow ? H : hs[k].h), off = v ? 0 : (H - cross) / 2;
        const keep = sh.slot || (growOf(it, L.type) === 'F' && sh.add[k] > 0);
        const own = keep ? (v ? hs[k].h : hs[k].w) : len, lead = keep ? (len - own) / 2 : 0;
        if (v) place(it, x, at + lead, W, own); else place(it, at + lead, y + off, own, cross);
        at += len;
      });
      return;
    }
    if (L.type === 'F') {
      const lw = Math.max(0, ...L.items.map(i => textW(i.label))), fieldX = x + (lw ? lw + sp : 0);
      let at = y;
      for (const it of L.items) {
        const h = qtItemHint(r, it), rowH = Math.max(h.h, it.label != null ? LH : 0);
        place(it, fieldX, at + (rowH - h.h) / 2, x + W - fieldX, h.h);
        at += rowH + sp;
      }
      return;
    }
    const g = qtGrid(r, L);
    const fw = W - sp * (g.cw.length - 1) - g.cw.reduce((a, b) => a + b, 0), fh = H - sp * (g.rh.length - 1) - g.rh.reduce((a, b) => a + b, 0);
    const colGrow = g.cw.map((_, c) => (g.cells.some(i => i.col === c && growOf(i, 'H') === 'E') ? 'E' : 'P'));
    const rowGrow = g.rh.map((_, rr) => (g.cells.some(i => i.row === rr && growOf(i, 'V') === 'E') ? 'E' : g.cells.some(i => i.row === rr && growOf(i, 'V') === 'P') ? 'P' : 'F'));
    const ca = share(fw, colGrow.map(gr => ({ grow: gr }))).add, ra = share(fh, rowGrow.map(gr => ({ grow: gr }))).add;
    const cx = [], cy = [];
    g.cw.reduce((a, w, c) => { cx[c] = a; return a + w + ca[c] + sp; }, x);
    g.rh.reduce((a, h, k) => { cy[k] = a; return a + h + ra[k] + sp; }, y);
    for (const it of g.cells) {
      const c = it.col ?? 0, rr = it.row ?? 0, cs = it.colspan ?? 1, rs = it.rowspan ?? 1;
      const w = g.cw.slice(c, c + cs).reduce((a, b) => a + b, 0) + ca.slice(c, c + cs).reduce((a, b) => a + b, 0) + sp * (cs - 1);
      const h = g.rh.slice(rr, rr + rs).reduce((a, b) => a + b, 0) + ra.slice(rr, rr + rs).reduce((a, b) => a + b, 0) + sp * (rs - 1);
      const hint = qtItemHint(r, it), keepH = growOf(it, 'V') === 'F';
      place(it, cx[c], cy[rr] + (keepH ? (h - hint.h) / 2 : 0), w, keepH ? hint.h : h);
      const wd = r.widgets.get(it.name);
      if (wd) wd.cell = { r: rr, c };
    }
  }
  /* A widget's box: from its layout (rules), its geometry (exact when the code says the numbers), or nowhere said
     (Qt puts a child with no layout at 0, 0, at its size hint). */
  function qtPlace(r, w, x, y, W, H, by) {
    if (w.placed) return;
    w.placed = true;
    if (by === 'layout') { w.box = { x, y, w: W, h: H }; w.how = 'rules'; }
    else if (w.geom) {
      const size = w.size && w.size.w != null ? w.size : null;
      w.box = { x: x + (w.geom.x ?? 0), y: y + (w.geom.y ?? 0), w: w.geom.w ?? (size ? size.w : 100), h: w.geom.h ?? (size ? size.h : 30) };
      w.how = w.geom.literal ? 'exact' : 'sketch';
      if (!w.geom.literal) w.why = 'Its place is worked out when the program runs, from numbers this code doesn\'t say.';
    } else {
      // (in no layout and never sized, a widget is Qt's 100 by 30, at 0, 0)
      const size = w.size && w.size.w != null ? w.size : null;
      w.box = { x, y, w: size ? size.w : 100, h: size ? size.h : 30 };
      w.how = by === 'window' ? 'exact' : 'rules';
    }
    // what's in it: its layout's items, then children placed by geometry or not at all
    const inner = { x: w.box.x, y: w.box.y + (w.type === 'QGroupBox' ? LH : 0), w: w.box.w, h: w.box.h - (w.type === 'QGroupBox' ? LH : 0) };
    if (w.central) { const c = r.widgets.get(w.central); if (c) qtPlace(r, c, inner.x, inner.y, inner.w, inner.h, 'layout'); }
    if (w.layout && r.layouts.has(w.layout)) qtArrange(r, r.layouts.get(w.layout), inner.x, inner.y, inner.w, inner.h);
    for (const c of r.widgets.values()) if (c.parent === w.name && !c.inLayout && c.name !== w.central) qtPlace(r, c, w.box.x, w.box.y, 0, 0, 'parent');
  }
  // the tree a window's parts make: a widget's children are what's in its layout (and those layouts'), and its own
  function qtChildren(r, w) {
    const out = [], seen = new Set();
    const fromLayout = (L) => { for (const it of L.items) { if (it.what === 'widget' && r.widgets.has(it.name) && !seen.has(it.name)) { seen.add(it.name); out.push(r.widgets.get(it.name)); } else if (it.what === 'layout' && r.layouts.has(it.name)) fromLayout(r.layouts.get(it.name)); } };
    if (w.central && r.widgets.has(w.central)) { seen.add(w.central); out.push(r.widgets.get(w.central)); }
    if (w.layout && r.layouts.has(w.layout)) fromLayout(r.layouts.get(w.layout));
    for (const c of r.widgets.values()) if (c.parent === w.name && !seen.has(c.name) && !c.inLayout) { seen.add(c.name); out.push(c); }
    return out;
  }
  function qtNode(r, w, id, toolkit) {
    const g = w.geom;
    const node = { id: id(w.window ? (w.cls || w.name) : w.name), kind: w.window ? 'window' : w.kind, type: w.type, name: w.window ? (w.cls || w.name) : w.name,
      label: w.window ? (w.title || '') : (w.text != null ? w.text : ''), how: w.window ? (w.size && w.size.literal ? 'exact' : 'sketch') : (w.how || 'sketch'),
      x: Math.round(w.box ? w.box.x : 0), y: Math.round(w.box ? w.box.y : 0), w: Math.round(w.box ? w.box.w : 0), h: Math.round(w.box ? w.box.h : 0), src: w.src,
      place: w.window ? 'qtwindow' : g && g.literal ? (g.how === 'setGeometry' ? 'qtgeom' : 'qtmove') : w.inLayout ? 'qtlayout' : 'none', children: [],
      geom: g ? { line: g.line, how: g.how, size: w.size || null } : w.window && w.size ? { line: w.size.line, size: w.size } : w.inLayout ? { line: -1, layout: r.layouts.get(w.inLayout).type } : null,
      cell: w.cell || null, grid: null, why: w.why || (w.window && !(w.size && w.size.literal) ? 'Its size is worked out from what it holds (no resize() with numbers here).' : null) };
    if (w.window && w.size && w.size.literal) node.geom.size = w.size;
    node.children = qtChildren(r, w).filter(c => c.box).map(c => qtNode(r, c, id, toolkit));
    return node;
  }
  function qtWindows(files, lang, toolkit) {
    const windows = [], notes = [];
    for (const f of files) {
      const r = readQt(f, lang);
      if (!r) continue;
      for (const w of r.widgets.values()) {
        if (!w.window) continue;
        // its size: resize(w, h), or what its layout asks for (at least 200 by 100), or Qt's 640 by 480 for one with neither
        const lh = w.layout && r.layouts.has(w.layout) ? qtLayoutHint(r, r.layouts.get(w.layout)) : w.central && r.widgets.has(w.central) ? qtWidgetHint(r, r.widgets.get(w.central)) : null;
        const W = w.size && w.size.w != null ? w.size.w : lh ? Math.max(200, lh.w) : 640, H = w.size && w.size.h != null ? w.size.h : lh ? Math.max(100, lh.h) : 480;
        for (const x of r.widgets.values()) x.placed = false;
        w.placed = true; w.box = { x: 0, y: 0, w: W, h: H };
        if (w.central && r.widgets.has(w.central)) qtPlace(r, r.widgets.get(w.central), 0, 0, W, H, 'layout');
        if (w.layout && r.layouts.has(w.layout)) qtArrange(r, r.layouts.get(w.layout), 0, 0, W, H);
        for (const c of r.widgets.values()) if (c.parent === w.name && !c.inLayout && c.name !== w.central) qtPlace(r, c, 0, 0, 0, 0, 'parent');
        windows.push({ title: w.title || w.cls || w.name, toolkit, path: f.path, w: Math.round(W), h: Math.round(H), root: qtNode(r, w, ids(), toolkit) });
      }
      for (const w of r.widgets.values()) if (!w.window && !w.parent && !w.inLayout && !(w.name || '').startsWith('@')) notes.push(`${w.name} (${f.path}, line ${w.src[0].line + 1}) is made but not put in a window or a layout, so no window shows it.`);
    }
    return { windows, notes };
  }

  // a drag of a Qt part: setGeometry's or move()'s numbers; a corner: setGeometry's size, or move() becomes setGeometry
  function qtMove(files, node, dx, dy) {
    const g = node.geom, file = fileOf(files, node), line = file && linesOf(file.code)[g.line];
    if (!line) return { why: 'Its code isn\'t in the project.' };
    const at = ` (${file.path}, line ${g.line + 1})`;
    const call = node.place === 'qtgeom' ? 'setGeometry' : 'move';
    const out = withInside(line, call, (inner) => { const a = splitArgs(inner); if (a.length < 2) return null; a[0] = String(+a[0] + dx); a[1] = String(+a[1] + dy); return a.join(', '); });
    if (!out) return { why: `${call}() is written over more than one line${at}: change its numbers there.` };
    const a = splitArgs(bracket(out, out.indexOf('(', out.search(new RegExp(`\\b${call}\\s*\\(`)))).inner);
    return { path: file.path, line: g.line, text: out, x: +a[0], y: +a[1] };
  }
  function qtResize(files, node, w, h) {
    const g = node.geom, file = fileOf(files, node);
    if (node.kind === 'window') {
      if (!g || !g.size || !g.size.literal) return { why: node.why || 'Its size is worked out when it runs.' };
      const line = linesOf(file.code)[g.size.line], call = g.size.fixed ? 'setFixedSize' : 'resize';
      const out = withInside(line, call, () => `${w}, ${h}`);
      return out ? { path: file.path, line: g.size.line, text: out, w, h } : { why: `${call}() is written over more than one line: change its numbers there.` };
    }
    const line = linesOf(file.code)[g.line];
    if (node.place === 'qtgeom') {
      const out = withInside(line, 'setGeometry', (inner) => { const a = splitArgs(inner); if (a.length !== 4) return null; a[2] = String(w); a[3] = String(h); return a.join(', '); });
      return out ? { path: file.path, line: g.line, text: out, w, h } : { why: 'setGeometry() is written over more than one line: change its numbers there.' };
    }
    // move(x, y): the same place, and a size: setGeometry(x, y, w, h)
    const out = withInside(line, 'move', (inner) => { const a = splitArgs(inner); return a.length === 2 ? `${a[0]}, ${a[1]}, ${w}, ${h}` : null; });
    return out ? { path: file.path, line: g.line, text: out.replace(/\bmove\s*\(/, 'setGeometry('), w, h } : { why: 'move() is written over more than one line: change its numbers there.' };
  }
  const fileOf = (files, node) => { const p = (node.src.find(s => s.role === 'placed') || node.src[0] || {}).path; return files.find(f => f.path === p); };
  const layoutWhy = (node, kind) => `${kind} places it${node.geom && node.geom.layout ? '' : ''}, one after another (or in its cell), at the size it asks for, so a drag can't say where it goes. Change the order there, or give it a place of its own with setGeometry(x, y, w, h).`;

  const qtKit = (lang) => ({
    name: lang === 'python' ? 'PySide/PyQt' : 'Qt',
    places: lang === 'python' ? ['qtgeom', 'qtmove', 'qtwindow', 'qtlayout'] : [],   // (the C++ kit shares the Python kit's moves)
    KINDS: QT_KINDS,
    estimate: (files) => qtWindows(files.filter(f => (lang === 'python' ? /\.pyw?$/i : /\.(?:cpp|cc|cxx|h|hpp|hh)$/i).test(f.path)), lang, lang === 'python' ? 'PySide/PyQt' : 'Qt'),
    move(files, node, dx, dy) {
      if (node.place === 'qtwindow') return { why: 'A window is moved by whoever opens it; its size is in the code, its place on the screen isn\'t.' };
      if (node.place === 'qtlayout') return { why: layoutWhy(node, 'Its layout') };
      return qtMove(files, node, dx, dy);
    },
    resize(files, node, w, h) {
      if (node.place === 'qtlayout') return { why: 'Its layout gives it the size it asks for (its size hint), so a drag can\'t say it: setFixedSize(w, h) there, or give it a place of its own with setGeometry(x, y, w, h).' };
      return qtResize(files, node, w, h);
    },
  });
  const qtPy = qtKit('python'), qtCpp = qtKit('cpp');


  /* ------------------------------------------------------------------ */
  /* wxPython                                                            */
  /* ------------------------------------------------------------------ */

  const WX_KINDS = { Frame: 'window', Dialog: 'window', Panel: 'frame', Button: 'button', ToggleButton: 'button', BitmapButton: 'button', StaticText: 'label',
    TextCtrl: 'entry', ListBox: 'list', ListCtrl: 'list', TreeCtrl: 'list', CheckBox: 'check', RadioButton: 'check', Choice: 'choice', ComboBox: 'choice',
    Slider: 'slider', Gauge: 'progress', SpinCtrl: 'entry', StaticBox: 'frame', StaticLine: 'line', Notebook: 'frame', ScrolledWindow: 'frame',
    StaticBitmap: 'picture', HyperlinkCtrl: 'link', RadioBox: 'frame', CheckListBox: 'list', SearchCtrl: 'entry' };
  const WX_SIZERS = { BoxSizer: 'box', StaticBoxSizer: 'box', GridSizer: 'grid', FlexGridSizer: 'flex', WrapSizer: 'box' };
  // a frame's size is the window's, its title bar and borders too: what's inside is this much smaller (Windows)
  const WX_CHROME = { w: 16, h: 39 };
  function wxHint(w) {
    const t = w.type, tw = textW(w.text);
    switch (t) {
      case 'Button': case 'ToggleButton': return { w: Math.max(75, tw + 16), h: 23 };
      case 'StaticText': return { w: Math.max(tw, 1), h: 15 * Math.max(1, String(w.text || '').split('\n').length) };
      case 'TextCtrl': case 'SearchCtrl': return w.multiline ? { w: 100, h: 60 } : { w: 80, h: 23 };
      case 'CheckBox': case 'RadioButton': return { w: tw + 20, h: 17 };
      case 'Choice': case 'ComboBox': return { w: 80, h: 23 };
      case 'SpinCtrl': return { w: 80, h: 23 };
      case 'Slider': return w.vertical ? { w: 24, h: 100 } : { w: 100, h: 24 };
      case 'Gauge': return { w: 100, h: 22 };
      case 'ListBox': case 'CheckListBox': return { w: 80, h: 80 };
      case 'ListCtrl': case 'TreeCtrl': return { w: 200, h: 120 };
      case 'StaticLine': return { w: 20, h: 2 };
      default: return { w: 20, h: 20 };
    }
  }
  /* Read: the windows and widgets made (wx.Button(panel, label="Add", pos=(10, 10), size=(80, 30))), the sizers and
     what's added to them (with their proportion, flags and border), and the events bound. */
  function readWx(file) {
    const code = String(file.code);
    if (!/\bimport\s+wx\b|\bfrom\s+wx\b/.test(code)) return null;
    const raw = linesOf(code), st = statements(code, 'py'), widgets = new Map(), sizers = new Map(), classes = new Map();
    let cls = null;
    const indent = (line) => (raw[line] || '').match(/^\s*/)[0].length;
    const src = (line, role) => ({ path: file.path, line, role });
    const key = (s) => { const n = String(s || '').trim().replace(/^self\./, ''); return n === 'self' ? (cls ? '@' + cls : null) : n === 'None' ? null : n; };
    const flagsOf = (s) => String(s || '').split('|').map(x => x.trim().replace(/^wx\./, '')).filter(Boolean);
    const widget = (name, type, line, kw, pos) => {
      const w = { name, type, kind: WX_KINDS[type] || 'frame', text: null, parent: null, sizer: null, pos: null, size: null, title: null, src: [src(line, 'made')], window: type === 'Frame' || type === 'Dialog', line, multiline: false, vertical: false };
      const text = kw.label ?? kw.value ?? kw.title;
      if (text != null && strOf(text) != null) w.text = strOf(text);
      if (pos[0] != null) w.parent = key(pos[0]);
      else if (kw.parent) w.parent = key(kw.parent);
      // (a label after the parent and the id: wx.Button(panel, wx.ID_ANY, "Add"))
      if (w.text == null) for (const p of pos.slice(1)) { const t2 = strOf(p); if (t2 != null) { w.text = t2; break; } }
      if (kw.title && strOf(kw.title) != null) w.title = strOf(kw.title);
      const P = pair(kw.pos), S = pair(kw.size);
      if (P) w.pos = { x: P[0], y: P[1], line, literal: true }; else if (kw.pos) w.pos = { line, literal: false };
      if (S) w.size = { w: S[0], h: S[1], line, literal: true }; else if (kw.size && !/DefaultSize/.test(kw.size)) w.size = { line, literal: false };
      if (/TE_MULTILINE/.test(kw.style || '')) w.multiline = true;
      if (/SL_VERTICAL|GA_VERTICAL/.test(kw.style || '')) w.vertical = true;
      widgets.set(name, w);
      return w;
    };
    for (const s of st) {
      const t = s.text;
      let m;
      if ((m = t.match(/^class\s+(\w+)\s*\(\s*wx\.(Frame|Dialog|Panel)\s*\)\s*:?$/))) {
        cls = m[1];
        const w = widget('@' + cls, m[2], s.line, {}, []);
        w.window = m[2] !== 'Panel'; w.cls = cls; w.title = cls; classes.set(cls, w);
        continue;
      }
      if (cls && indent(s.line) === 0 && !/^(?:class|def|@)/.test(t)) cls = null;
      // the class's own window: super().__init__(None, title="…", size=(400, 300)) / wx.Frame.__init__(self, …)
      if (cls && (m = t.match(/^(?:super\s*\(\s*(?:\w+\s*,\s*self)?\s*\)\.__init__|wx\.(?:Frame|Dialog|Panel)\.__init__)\s*\(([\s\S]*)\)$/))) {
        const w = widgets.get('@' + cls), a = args(m[1]);
        const pos = /^wx\./.test(t) ? a.pos.slice(1) : a.pos;
        if (w.type === 'Panel' && pos[0] != null) w.parent = key(pos[0]);
        if (a.kw.title && strOf(a.kw.title) != null) w.title = strOf(a.kw.title);
        if (w.title === cls) { const t2 = pos.slice(1).map(strOf).find(x => x != null); if (t2) w.title = t2; }
        const S = pair(a.kw.size);
        if (S) { w.size = { w: S[0], h: S[1], line: s.line, literal: true }; w.src.push(src(s.line, 'placed')); }
        continue;
      }
      const made = t.match(/^((?:self\.)?\w+)\s*=\s*wx\.(\w+)\s*\(([\s\S]*)\)$/);
      if (made && (WX_KINDS[made[2]] || WX_SIZERS[made[2]])) {
        const name = key(made[1]), a = args(made[3]);
        if (WX_SIZERS[made[2]]) {
          const S = { name, type: WX_SIZERS[made[2]], vertical: /VERTICAL/.test(made[3]), items: [], rows: 0, cols: 0, vgap: 0, hgap: 0, growCols: [], growRows: [], line: s.line, nested: false };
          if (S.type === 'box' && made[2] === 'StaticBoxSizer') S.vertical = /VERTICAL/.test(made[3]);
          if (S.type !== 'box') {
            const n = a.pos.map(v => num(v));
            if (a.kw.cols || a.kw.rows) { S.rows = num(a.kw.rows) || 0; S.cols = num(a.kw.cols) || 0; S.vgap = num(a.kw.vgap) || 0; S.hgap = num(a.kw.hgap) || 0; }
            else if (n.length >= 4) [S.rows, S.cols, S.vgap, S.hgap] = n;
            else if (n.length === 3) [S.cols, S.vgap, S.hgap] = n;
            else if (n.length === 2) [S.rows, S.cols] = n;
          }
          sizers.set(name, S);
          continue;
        }
        const w = widget(name, made[2], s.line, a.kw, a.pos);
        if (w.window && !w.parent && !cls) w.title = w.title || name;
        if (w.type === 'Frame' || w.type === 'Dialog') { w.window = true; if (w.size && w.size.literal) w.src.push(src(s.line, 'placed')); }
        continue;
      }
      // sizer.Add(item, proportion, flag, border) / AddSpacer(n) / AddStretchSpacer(p)
      if ((m = t.match(/^((?:self\.)?\w+)\.(Add|AddSpacer|AddStretchSpacer|SetSizer|SetSizerAndFit|AddGrowableCol|AddGrowableRow|SetTitle|SetSize|SetPosition|Move|Bind|Fit)\s*\(([\s\S]*)\)$/))) {
        const who = key(m[1]), fn = m[2], a = args(m[3]);
        const S = sizers.get(who), w = widgets.get(who);
        if (S) {
          if (fn === 'Add') {
            const item = key(a.pos[0]), prop = num(a.pos[1] ?? a.kw.proportion) ?? 0, flags = flagsOf(a.pos[2] ?? a.kw.flag), border = num(a.pos[3] ?? a.kw.border) ?? 0;
            const sp = pair(a.pos[0]);
            if (sp) S.items.push({ what: 'space', w: sp[0], h: sp[1], prop, flags, border });
            else {
              S.items.push({ what: sizers.has(item) ? 'sizer' : 'widget', name: item, prop, flags, border, line: s.line });
              if (sizers.has(item)) sizers.get(item).nested = true;
              const c = widgets.get(item);
              if (c) { c.inSizer = who; c.src.push(src(s.line, 'placed')); }
            }
          } else if (fn === 'AddSpacer') S.items.push({ what: 'space', w: num(a.pos[0]) || 0, h: num(a.pos[0]) || 0, prop: 0, flags: [], border: 0 });
          else if (fn === 'AddStretchSpacer') S.items.push({ what: 'space', w: 0, h: 0, prop: num(a.pos[0]) ?? 1, flags: [], border: 0 });
          else if (fn === 'AddGrowableCol') S.growCols.push(num(a.pos[0]) ?? 0);
          else if (fn === 'AddGrowableRow') S.growRows.push(num(a.pos[0]) ?? 0);
          continue;
        }
        if (w && (fn === 'SetSizer' || fn === 'SetSizerAndFit')) { w.sizer = key(a.pos[0]); continue; }
        if (w && fn === 'SetTitle' && strOf(a.pos[0]) != null) { w.title = strOf(a.pos[0]); continue; }
        if (w && (fn === 'SetPosition' || fn === 'Move')) {
          const P = pair(a.pos.length === 2 ? `(${a.pos[0]}, ${a.pos[1]})` : a.pos[0]);
          w.pos = P ? { x: P[0], y: P[1], line: s.line, literal: true, how: fn } : { line: s.line, literal: false };
          w.src.push(src(s.line, 'placed'));
          continue;
        }
        if (w && fn === 'SetSize') { const S2 = pair(a.pos.length === 2 ? `(${a.pos[0]}, ${a.pos[1]})` : a.pos[0]); w.size = S2 ? { w: S2[0], h: S2[1], line: s.line, literal: true, how: fn } : { line: s.line, literal: false }; if (w.window) w.src.push(src(s.line, 'placed')); continue; }
        if (fn === 'Bind') {
          // btn.Bind(wx.EVT_BUTTON, self.on_add) / self.Bind(wx.EVT_BUTTON, self.on_add, btn)
          const target = a.pos[2] ? key(a.pos[2]) : who;
          if (widgets.has(target)) widgets.get(target).src.push(src(s.line, 'does'));
          continue;
        }
      }
    }
    if (![...widgets.values()].some(w => w.window)) return null;
    return { widgets, sizers };
  }
  // the room an item asks for, with its border on the sides its flags say
  const WX_SIDES = (flags) => { const all = flags.includes('ALL'); return { l: all || flags.includes('LEFT'), r: all || flags.includes('RIGHT'), t: all || flags.includes('TOP'), b: all || flags.includes('BOTTOM') }; };
  function wxWidgetHint(r, w) {
    let h = wxHint(w);
    if (w.sizer && r.sizers.has(w.sizer)) { const sh = wxSizerHint(r, r.sizers.get(w.sizer)); h = { w: Math.max(sh.w, w.type === 'Panel' ? 0 : h.w), h: Math.max(sh.h, w.type === 'Panel' ? 0 : h.h) }; }
    if (w.size && w.size.literal) h = { w: w.size.w > 0 ? w.size.w : h.w, h: w.size.h > 0 ? w.size.h : h.h };
    return h;
  }
  function wxItemHint(r, it) {
    const own = it.what === 'widget' ? (r.widgets.has(it.name) ? wxWidgetHint(r, r.widgets.get(it.name)) : { w: 0, h: 0 })
      : it.what === 'sizer' ? (r.sizers.has(it.name) ? wxSizerHint(r, r.sizers.get(it.name)) : { w: 0, h: 0 }) : { w: it.w, h: it.h };
    const sd = WX_SIDES(it.flags || []), b = it.border || 0;
    return { w: own.w + (sd.l ? b : 0) + (sd.r ? b : 0), h: own.h + (sd.t ? b : 0) + (sd.b ? b : 0), own };
  }
  function wxSizerHint(r, S) {
    const hs = S.items.map(i => wxItemHint(r, i));
    if (S.type === 'box') return S.vertical ? { w: Math.max(0, ...hs.map(h => h.w)), h: hs.reduce((a, h) => a + h.h, 0) } : { w: hs.reduce((a, h) => a + h.w, 0), h: Math.max(0, ...hs.map(h => h.h)) };
    const g = wxGrid(r, S);
    return { w: g.cw.reduce((a, b) => a + b, 0) + S.hgap * Math.max(0, g.cw.length - 1), h: g.rh.reduce((a, b) => a + b, 0) + S.vgap * Math.max(0, g.rh.length - 1) };
  }
  function wxGrid(r, S) {
    const n = S.items.length, cols = S.cols || Math.max(1, Math.ceil(n / Math.max(1, S.rows))), rows = S.rows || Math.max(1, Math.ceil(n / cols));
    const hs = S.items.map(i => wxItemHint(r, i));
    let cw = Array(cols).fill(0), rh = Array(rows).fill(0);
    hs.forEach((h, k) => { const c = k % cols, rr = Math.floor(k / cols); cw[c] = Math.max(cw[c], h.w); rh[rr] = Math.max(rh[rr], h.h); });
    if (S.type === 'grid') { const mw = Math.max(0, ...cw), mh = Math.max(0, ...rh); cw = cw.map(() => mw); rh = rh.map(() => mh); }
    return { cols, rows, cw, rh, hs };
  }
  function wxArrange(r, S, x, y, W, H) {
    const put = (it, bx, by, bw, bh) => {
      const sd = WX_SIDES(it.flags || []), b = it.border || 0;
      const ix = bx + (sd.l ? b : 0), iy = by + (sd.t ? b : 0), iw = bw - (sd.l ? b : 0) - (sd.r ? b : 0), ih = bh - (sd.t ? b : 0) - (sd.b ? b : 0);
      if (it.what === 'widget' && r.widgets.has(it.name)) wxPlace(r, r.widgets.get(it.name), ix, iy, iw, ih, 'sizer');
      else if (it.what === 'sizer' && r.sizers.has(it.name)) wxArrange(r, r.sizers.get(it.name), ix, iy, iw, ih);
    };
    if (S.type === 'box') {
      const v = S.vertical, hs = S.items.map(i => wxItemHint(r, i)), props = S.items.map(i => i.prop || 0), total = props.reduce((a, b) => a + b, 0);
      const free = Math.max(0, (v ? H : W) - hs.reduce((a, h) => a + (v ? h.h : h.w), 0));
      let at = v ? y : x;
      S.items.forEach((it, k) => {
        const len = (v ? hs[k].h : hs[k].w) + (total ? free * props[k] / total : 0);
        // across: the whole room with EXPAND, else its own size, at the start (or centred / at the end, as it says)
        const expand = (it.flags || []).includes('EXPAND') || (it.flags || []).includes('GROW');
        const crossAll = v ? W : H, crossOwn = v ? hs[k].w : hs[k].h, cross = expand ? crossAll : crossOwn;
        const fl = it.flags || [], end = fl.includes(v ? 'ALIGN_RIGHT' : 'ALIGN_BOTTOM'), mid = fl.includes('ALIGN_CENTER') || fl.includes('ALIGN_CENTRE') || fl.includes(v ? 'ALIGN_CENTER_HORIZONTAL' : 'ALIGN_CENTER_VERTICAL');
        const off = expand ? 0 : end ? crossAll - cross : mid ? (crossAll - cross) / 2 : 0;
        if (v) put(it, x + off, at, cross, len); else put(it, at, y + off, len, cross);
        at += len;
      });
      return;
    }
    const g = wxGrid(r, S);
    const fw = W - S.hgap * (g.cols - 1) - g.cw.reduce((a, b) => a + b, 0), fh = H - S.vgap * (g.rows - 1) - g.rh.reduce((a, b) => a + b, 0);
    let cw = g.cw, rh = g.rh;
    if (S.type === 'grid') { cw = cw.map(c => c + Math.max(0, fw) / g.cols); rh = rh.map(h => h + Math.max(0, fh) / g.rows); }
    else {
      if (S.growCols.length && fw > 0) cw = cw.map((c, k) => c + (S.growCols.includes(k) ? fw / S.growCols.length : 0));
      if (S.growRows.length && fh > 0) rh = rh.map((h, k) => h + (S.growRows.includes(k) ? fh / S.growRows.length : 0));
    }
    S.items.forEach((it, k) => {
      const c = k % g.cols, rr = Math.floor(k / g.cols);
      const cx = x + cw.slice(0, c).reduce((a, b) => a + b, 0) + S.hgap * c, cy = y + rh.slice(0, rr).reduce((a, b) => a + b, 0) + S.vgap * rr;
      const expand = (it.flags || []).includes('EXPAND');
      put(it, cx, cy, expand ? cw[c] : g.hs[k].w, expand ? rh[rr] : g.hs[k].h);
      const wd = it.what === 'widget' && r.widgets.get(it.name);
      if (wd) wd.cell = { r: rr, c };
    });
  }
  function wxPlace(r, w, x, y, W, H, by) {
    if (w.placed) return;
    w.placed = true;
    if (by === 'sizer') { w.box = { x, y, w: W, h: H }; w.how = 'rules'; }
    else if (by === 'fill') { w.box = { x, y, w: W, h: H }; w.how = 'exact'; }
    else if (w.pos) {
      const h = wxWidgetHint(r, w);
      w.box = { x: x + (w.pos.x ?? 0), y: y + (w.pos.y ?? 0), w: h.w, h: h.h };
      w.how = w.pos.literal ? (w.size && w.size.literal ? 'exact' : 'exact') : 'sketch';
      if (!w.pos.literal) w.why = 'Its place is worked out when the program runs.';
    } else { const h = wxWidgetHint(r, w); w.box = { x, y, w: h.w, h: h.h }; w.how = 'rules'; }
    if (w.sizer && r.sizers.has(w.sizer)) wxArrange(r, r.sizers.get(w.sizer), w.box.x, w.box.y, w.box.w, w.box.h);
    // a frame's one panel fills it; the rest are where they say
    const kids = [...r.widgets.values()].filter(c => c.parent === w.name && !c.inSizer);
    for (const c of kids) {
      if (!w.sizer && c.type === 'Panel' && kids.length === 1 && !c.pos) wxPlace(r, c, w.box.x, w.box.y, w.box.w, w.box.h, 'fill');
      else wxPlace(r, c, w.box.x, w.box.y, 0, 0, 'parent');
    }
  }
  function wxChildren(r, w) {
    const out = [], seen = new Set();
    const fromSizer = (S) => { for (const it of S.items) { if (it.what === 'widget' && r.widgets.has(it.name) && !seen.has(it.name)) { seen.add(it.name); out.push(r.widgets.get(it.name)); } else if (it.what === 'sizer' && r.sizers.has(it.name)) fromSizer(r.sizers.get(it.name)); } };
    if (w.sizer && r.sizers.has(w.sizer)) fromSizer(r.sizers.get(w.sizer));
    for (const c of r.widgets.values()) if (c.parent === w.name && !seen.has(c.name) && !c.inSizer) { seen.add(c.name); out.push(c); }
    return out;
  }
  function wxNode(r, w, id) {
    const p = w.pos;
    const node = { id: id(w.window ? (w.cls || w.name) : w.name), kind: w.window ? 'window' : w.kind, type: w.type, name: w.window ? (w.cls || w.name) : w.name,
      label: w.window ? (w.title || '') : (w.text ?? ''), how: w.window ? (w.size && w.size.literal ? 'exact' : 'sketch') : (w.how || 'sketch'),
      x: Math.round(w.box ? w.box.x : 0), y: Math.round(w.box ? w.box.y : 0), w: Math.round(w.box ? w.box.w : 0), h: Math.round(w.box ? w.box.h : 0), src: w.src,
      place: w.window ? 'wxwindow' : p && p.literal ? 'wxpos' : w.inSizer ? 'wxsizer' : 'none', children: [],
      geom: w.window ? (w.size ? { line: w.size.line, size: w.size } : null) : p ? { line: p.line, pos: p, size: w.size || null } : w.inSizer ? { line: -1 } : null,
      cell: w.cell || null, grid: null, why: w.why || (w.window && !(w.size && w.size.literal) ? 'Its size is worked out when it runs (no size=(w, h) here).' : null) };
    node.children = wxChildren(r, w).filter(c => c.box).map(c => wxNode(r, c, id));
    return node;
  }
  function wxWindows(files) {
    const windows = [], notes = [];
    for (const f of files.filter(f => /\.pyw?$/i.test(f.path))) {
      const r = readWx(f);
      if (!r) continue;
      for (const w of r.widgets.values()) {
        if (!w.window) continue;
        // what's inside its title bar and borders: its size less those, or what its sizer asks for, or wx's 400 by 250
        const sh = w.sizer && r.sizers.has(w.sizer) ? wxSizerHint(r, r.sizers.get(w.sizer)) : null;
        const W = w.size && w.size.literal ? w.size.w - WX_CHROME.w : sh ? sh.w : 400 - WX_CHROME.w, H = w.size && w.size.literal ? w.size.h - WX_CHROME.h : sh ? sh.h : 250 - WX_CHROME.h;
        for (const x of r.widgets.values()) x.placed = false;
        w.placed = false;
        wxPlace(r, w, 0, 0, W, H, 'fill');
        windows.push({ title: w.title || w.cls || w.name, toolkit: 'wxPython', path: f.path, w: Math.round(W), h: Math.round(H), root: wxNode(r, w, ids()) });
      }
      for (const w of r.widgets.values()) if (!w.window && !w.parent && !w.inSizer) notes.push(`${w.name} (${f.path}, line ${w.src[0].line + 1}) has no window to be in.`);
    }
    return { windows, notes };
  }
  // pos=(x, y) in the line that makes it (or SetPosition / Move); a corner: its size=(w, h), added when it has none
  function wxMove(files, node, dx, dy) {
    if (node.place === 'wxwindow') return { why: 'A window is moved by whoever opens it; its size is in the code, its place on the screen isn\'t.' };
    if (node.place === 'wxsizer') return { why: 'Its sizer places it, one after another (or in its cell), so a drag can\'t say where it goes. Change the order there, or give it pos=(x, y) and leave it out of the sizer.' };
    const g = node.geom, file = fileOf(files, node), line = file && linesOf(file.code)[g.line];
    if (!line) return { why: 'Its code isn\'t in the project.' };
    const nx = g.pos.x + dx, ny = g.pos.y + dy;
    const text = /\bpos\s*=\s*\(/.test(line) ? line.replace(/\bpos\s*=\s*\(\s*-?\d+\s*,\s*-?\d+\s*\)/, `pos=(${nx}, ${ny})`) : line.replace(/\b(SetPosition|Move)\s*\(\s*\(?\s*-?\d+\s*,\s*-?\d+\s*\)?\s*\)/, (m0, fn) => `${fn}((${nx}, ${ny}))`);
    return text === line ? { why: `Its place is written over more than one line (${file.path}, line ${g.line + 1}): change its numbers there.` } : { path: file.path, line: g.line, text, x: nx, y: ny };
  }
  function wxResize(files, node, w, h) {
    if (node.place === 'wxsizer') return { why: 'Its sizer gives it the size it asks for (with EXPAND, its room), so a drag can\'t say it: give it size=(w, h) where it\'s made.' };
    const file = fileOf(files, node), g = node.geom;
    if (node.place === 'wxwindow') {
      if (!g || !g.size || !g.size.literal) return { why: node.why || 'Its size is worked out when it runs.' };
      const line = linesOf(file.code)[g.size.line];
      // (the window's size counts its title bar and borders)
      const text = line.replace(/\bsize\s*=\s*\(\s*\d+\s*,\s*\d+\s*\)/, `size=(${w + WX_CHROME.w}, ${h + WX_CHROME.h})`).replace(/\bSetSize\s*\(\s*\(?\s*\d+\s*,\s*\d+\s*\)?\s*\)/, `SetSize((${w + WX_CHROME.w}, ${h + WX_CHROME.h}))`);
      return text === line ? { why: 'Its size is written over more than one line: change its numbers there.' } : { path: file.path, line: g.size.line, text, w, h };
    }
    const line = linesOf(file.code)[node.src[0].line];
    if (/\bsize\s*=\s*\(\s*\d+\s*,\s*\d+\s*\)/.test(line)) return { path: file.path, line: node.src[0].line, text: line.replace(/\bsize\s*=\s*\(\s*\d+\s*,\s*\d+\s*\)/, `size=(${w}, ${h})`), w, h };
    const text = withInside(line, `wx\\.${node.type}`, (inner) => inner.replace(/\s*$/, '') + `, size=(${w}, ${h})`);
    return text ? { path: file.path, line: node.src[0].line, text, w, h } : { why: 'Where it\'s made is written over more than one line: give it size=(w, h) there.' };
  }

  /* ------------------------------------------------------------------ */
  /* Dear ImGui (C++)                                                    */
  /* ------------------------------------------------------------------ */

  // its default style: the font's character 7 wide and 13 tall, padding 8 round a window and 4 by 3 in a frame,
  // 8 across and 4 down between items, a title bar 19 tall
  const IM = { ch: 7, font: 13, pad: 8, fx: 4, fy: 3, sx: 8, sy: 4, title: 19, inner: 4 };
  const IM_FRAME = IM.font + 2 * IM.fy;
  const IM_KINDS = { Button: 'button', SmallButton: 'button', ArrowButton: 'button', InvisibleButton: 'button', Text: 'label', TextColored: 'label', TextDisabled: 'label',
    TextWrapped: 'label', LabelText: 'label', BulletText: 'label', Checkbox: 'check', RadioButton: 'check', InputText: 'entry', InputTextMultiline: 'text', InputTextWithHint: 'entry',
    InputInt: 'entry', InputFloat: 'entry', InputDouble: 'entry', SliderFloat: 'slider', SliderInt: 'slider', SliderAngle: 'slider', DragFloat: 'slider', DragInt: 'slider',
    ColorEdit3: 'entry', ColorEdit4: 'entry', Combo: 'choice', ListBox: 'list', ProgressBar: 'progress', Separator: 'line', Selectable: 'label', CollapsingHeader: 'frame',
    Image: 'picture', PlotLines: 'canvas', PlotHistogram: 'canvas', Window: 'window' };
  const IM_ITEM = new RegExp(`\\bImGui::(${Object.keys(IM_KINDS).filter(k => k !== 'Window').join('|')}|SameLine|SetCursorPos|Spacing|NewLine|Dummy)\\s*\\(`);
  // what a label shows: before "##" ("Save##file" shows Save); "###" keeps the shown part too
  const imShown = (l) => String(l || '').split('##')[0];
  const imVec = (s) => { const m = String(s || '').match(/ImVec2\s*\(\s*(-?[\d.]+)f?\s*,\s*(-?[\d.]+)f?\s*\)/); return m ? [+m[1], +m[2]] : null; };
  function readImgui(file) {
    const code = blankComments(String(file.code));
    if (!/\bImGui::Begin\s*\(/.test(code)) return null;
    const windows = [], st = cppStatements(code);
    let win = null, nextPos = null, nextSize = null, sameLine = false, cursor = null;
    const src = (line, role) => ({ path: file.path, line, role });
    for (const s of st) {
      const t = s.text;
      let m;
      if ((m = t.match(/\bImGui::SetNextWindowPos\s*\(([\s\S]*)\)/))) { const v = imVec(m[1]); nextPos = { x: v ? v[0] : null, y: v ? v[1] : null, line: s.line, literal: !!v }; continue; }
      if ((m = t.match(/\bImGui::SetNextWindowSize\s*\(([\s\S]*)\)/))) { const v = imVec(m[1]); nextSize = { w: v ? v[0] : null, h: v ? v[1] : null, line: s.line, literal: !!v }; continue; }
      if ((m = t.match(/\bImGui::Begin\s*\(([\s\S]*)\)/))) {
        const a = splitArgs(m[1]), title = strOf(a[0]);
        win = { title: title != null ? imShown(title) : 'window', pos: nextPos, size: nextSize, items: [], line: s.line };
        windows.push(win); nextPos = nextSize = null; sameLine = false; cursor = null;
        continue;
      }
      if (/\bImGui::End\s*\(\s*\)/.test(t)) { win = null; continue; }
      if (!win || !(m = t.match(IM_ITEM))) continue;
      const fn = m[1], b = bracket(t, t.indexOf('(', m.index));
      const a = b ? splitArgs(b.inner) : [];
      if (fn === 'SameLine') { sameLine = true; continue; }
      if (fn === 'SetCursorPos') { const v = imVec(a[0]); cursor = { x: v ? v[0] : null, y: v ? v[1] : null, line: s.line, literal: !!v }; continue; }
      if (fn === 'Spacing') { win.items.push({ fn, gap: IM.sy, line: s.line }); continue; }
      if (fn === 'NewLine') { win.items.push({ fn, gap: IM.font, line: s.line }); continue; }
      if (fn === 'Dummy') { const v = imVec(a[0]); win.items.push({ fn, w: v ? v[0] : 0, h: v ? v[1] : 0, line: s.line, same: sameLine, cursor }); sameLine = false; cursor = null; continue; }
      const label = strOf(a[0]);
      const it = { fn, label: label != null ? imShown(label) : '', id: label, size: null, line: s.line, same: sameLine, cursor, wired: /^\s*if\s*\(/.test(t) };
      if (/^(?:Button|InvisibleButton|Selectable|ProgressBar|InputTextMultiline|ListBox|Image)$/.test(fn)) {
        const v = imVec(a.find(x => /ImVec2/.test(x)));
        if (v) it.size = { w: v[0], h: v[1], literal: true };
      }
      win.items.push(it);
      sameLine = false; cursor = null;
    }
    return windows.length ? windows : null;
  }
  // an item's size: its label's width (with its frame's padding), and for a field, the field (65% of the window's
  // width, as ImGui gives one) and its label after it
  function imSize(it, contentW) {
    const lw = textW(it.label) / CH * IM.ch, field = Math.max(1, Math.round(contentW * 0.65));
    const sized = (w, h) => (it.size && it.size.literal ? { w: it.size.w > 0 ? it.size.w : it.size.w < 0 ? contentW : w, h: it.size.h > 0 ? it.size.h : h } : { w, h });
    switch (it.fn) {
      case 'Button': return sized(lw + 2 * IM.fx, IM_FRAME);
      case 'SmallButton': return { w: lw + 2 * IM.fx, h: IM.font };
      case 'ArrowButton': return { w: IM_FRAME, h: IM_FRAME };
      case 'Text': case 'TextColored': case 'TextDisabled': case 'TextWrapped': case 'BulletText': return { w: lw + (it.fn === 'BulletText' ? IM.font + IM.inner : 0), h: IM.font };
      case 'LabelText': return { w: field + IM.inner + lw, h: IM.font };
      case 'Checkbox': case 'RadioButton': return { w: IM_FRAME + IM.inner + lw, h: IM_FRAME };
      case 'Selectable': case 'CollapsingHeader': return sized(contentW, it.fn === 'Selectable' ? IM.font : IM_FRAME);
      case 'Separator': return { w: contentW, h: 1 };
      case 'ProgressBar': return sized(contentW, IM_FRAME);
      case 'InputTextMultiline': return sized(field, IM.font * 16 + 2 * IM.fy);
      case 'ListBox': return sized(field + IM.inner + lw, 7.25 * (IM.font + IM.sy) + 2 * IM.fy);
      case 'Image': return sized(100, 100);
      case 'PlotLines': case 'PlotHistogram': return { w: field + IM.inner + lw, h: 2 * IM.fy + IM.font * 3 };
      default: return { w: field + (lw ? IM.inner + lw : 0), h: IM_FRAME };
    }
  }
  function imWindows(files) {
    const windows = [], notes = [];
    let cascade = 0;
    for (const f of files.filter(f => /\.(?:cpp|cc|cxx|h|hpp|hh)$/i.test(f.path))) {
      const read = readImgui(f);
      if (!read) continue;
      for (const w of read) {
        const id = ids();
        // laid out top to bottom from the window's padding, below its title bar; SameLine puts the next one to the right
        const W0 = w.size && w.size.literal ? w.size.w : 0, contentW = (W0 || 300) - 2 * IM.pad;
        const kids = [];
        let x = IM.pad, y = IM.title + IM.pad, lineH = 0, prev = null, right = 0;
        for (const it of w.items) {
          if (it.fn === 'Spacing' || it.fn === 'NewLine') { y += (prev ? lineH + IM.sy : 0) + it.gap; prev = null; lineH = 0; continue; }
          const sz = it.fn === 'Dummy' ? { w: it.w, h: it.h } : imSize(it, contentW);
          if (it.same && prev) { x = prev.x + prev.w + IM.sx; }
          else { if (prev) y += lineH + IM.sy; x = IM.pad; lineH = 0; }
          if (it.cursor && it.cursor.literal) { x = it.cursor.x; y = it.cursor.y; }
          const box = { x, y, w: sz.w, h: sz.h };
          lineH = Math.max(lineH, sz.h); right = Math.max(right, x + sz.w);
          prev = box;
          if (it.fn === 'Dummy') continue;
          kids.push({ id: id(it.label || it.fn), kind: IM_KINDS[it.fn] || 'frame', type: it.fn, name: it.label || null, label: it.label, how: it.cursor && it.cursor.literal ? 'exact' : 'rules',
            x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.w), h: Math.round(box.h),
            src: [src2(f, it.line, 'made'), ...(it.cursor ? [src2(f, it.cursor.line, 'placed')] : []), ...(it.wired ? [src2(f, it.line, 'does')] : [])],
            place: it.cursor && it.cursor.literal ? 'imcursor' : 'imflow', children: [], geom: { line: it.cursor ? it.cursor.line : it.line, cursor: it.cursor, item: it.line, size: it.size },
            cell: null, grid: null, why: it.cursor && !it.cursor.literal ? 'Its place is worked out when the program runs.' : null });
        }
        const bottom = prev ? y + lineH + IM.pad : IM.title + IM.pad * 2;
        const W = W0 || Math.max(right + IM.pad, 32 + 2 * IM.pad), H = w.size && w.size.literal ? w.size.h : bottom;
        const sized = !!(w.size && w.size.literal), placed = !!(w.pos && w.pos.literal);
        const src = [src2(f, w.line, 'made'), ...(w.pos ? [src2(f, w.pos.line, 'placed')] : []), ...(w.size ? [src2(f, w.size.line, 'sized')] : [])];
        windows.push({ title: w.title, toolkit: 'Dear ImGui', path: f.path, w: Math.round(W), h: Math.round(H), at: placed ? { x: w.pos.x, y: w.pos.y } : { x: 60 + cascade, y: 60 + cascade },
          root: { id: id(w.title), kind: 'window', type: 'Window', name: w.title, label: w.title, how: sized ? 'exact' : 'sketch', x: 0, y: 0, w: Math.round(W), h: Math.round(H), src,
            place: 'imwindow', children: kids, geom: { line: w.pos ? w.pos.line : w.line, pos: w.pos, size: w.size }, cell: null, grid: null,
            why: sized ? null : 'Its size fits what it holds (no SetNextWindowSize with numbers here), so it\'s shown at the size they make.' } });
        if (!placed) cascade += 20;
      }
    }
    return { windows, notes };
  }
  const src2 = (f, line, role) => ({ path: f.path, line, role });
  function imMove(files, node, dx, dy) {
    const g = node.geom, file = fileOf(files, node);
    if (node.place === 'imflow') return { why: 'ImGui puts it below the one before it (or beside it, after SameLine), so a drag can\'t say where it goes. Change the order there, or give it ImGui::SetCursorPos(ImVec2(x, y)) before it.' };
    if (node.kind === 'window') {
      if (!g.pos || !g.pos.literal) return { why: 'ImGui puts a new window where it likes (and remembers where it was moved to), so its place isn\'t in the code: give it ImGui::SetNextWindowPos(ImVec2(x, y)) before ImGui::Begin.' };
      return { why: 'Its place on the screen is the app\'s (ImGui::SetNextWindowPos): move it there, or drag one of its parts.' };
    }
    const line = linesOf(file.code)[g.cursor.line], nx = g.cursor.x + dx, ny = g.cursor.y + dy;
    const text = line.replace(/(SetCursorPos\s*\(\s*ImVec2\s*\()\s*-?[\d.]+f?\s*,\s*-?[\d.]+f?\s*\)/, `$1${nx}, ${ny})`);
    return text === line ? { why: 'SetCursorPos is written over more than one line: change its numbers there.' } : { path: file.path, line: g.cursor.line, text, x: nx, y: ny };
  }
  function imResize(files, node, w, h) {
    const g = node.geom, file = fileOf(files, node);
    if (node.kind === 'window') {
      if (!g.size || !g.size.literal) return { why: 'Its size fits what it holds: give it ImGui::SetNextWindowSize(ImVec2(w, h)) before ImGui::Begin.' };
      const line = linesOf(file.code)[g.size.line], text = line.replace(/(SetNextWindowSize\s*\(\s*ImVec2\s*\()\s*-?[\d.]+f?\s*,\s*-?[\d.]+f?\s*\)/, `$1${w}, ${h})`);
      return text === line ? { why: 'SetNextWindowSize is written over more than one line: change its numbers there.' } : { path: file.path, line: g.size.line, text, w, h };
    }
    const line = linesOf(file.code)[g.item];
    if (g.size && g.size.literal) {
      const text = line.replace(/(ImVec2\s*\()\s*-?[\d.]+f?\s*,\s*-?[\d.]+f?\s*\)/, `$1${w}, ${h})`);
      return { path: file.path, line: g.item, text, w, h };
    }
    if (node.type === 'Button') {
      const text = withInside(line, 'ImGui::Button', (inner) => { const a = splitArgs(inner); return a.length === 1 ? `${a[0]}, ImVec2(${w}, ${h})` : null; });
      if (text) return { path: file.path, line: g.item, text, w, h };
    }
    return { why: `ImGui sizes it from its label${/entry|slider|choice|list/.test(node.kind) ? ' and the window (ImGui::SetNextItemWidth before it sets the width)' : ''}, so a drag can't say it here.` };
  }

  const wxKit = { name: 'wxPython', places: ['wxpos', 'wxwindow', 'wxsizer'], KINDS: { ...WX_KINDS, ...Object.fromEntries(Object.entries(WX_KINDS).map(([k, v]) => ['wx' + k, v])) },
    estimate: (files) => wxWindows(files), move: wxMove, resize: wxResize };
  const imKit = { name: 'Dear ImGui', places: ['imwindow', 'imcursor', 'imflow'], KINDS: IM_KINDS, estimate: (files) => imWindows(files), move: imMove, resize: imResize };


  /* The probes, as files IntuaCode writes out: the Python ones IntuaCode runs (the desktop app does it), the C++ ones go in
     the app (each writes its report when the app runs with INTUACODE_LAYOUT set). */
  G.QT_PY_PROBE = "\"\"\"IntuaCode's layout probe for Qt in Python (PySide6, PyQt6, PyQt5, PySide2): runs the program, and once its windows\nare shown, reports where every widget is (as Qt laid it out, in the style it shows in), with a picture of each window,\nthen ends. Its windows are put out of sight while they're measured; with no screen at all (Linux with no display), Qt\ndraws nowhere (its offscreen platform, in its own style). Usage:\n    python -u probe_qt.py main.py [its arguments]\nIt prints one line, between two marks, of JSON: IntuaCode's layout report (version 1). A program that never opens a\nwindow, or hangs, is ended after 25 seconds (INTUACODE_PROBE_TIMEOUT), saying where it was on stderr.\"\"\"\nimport faulthandler, os, sys\n# (first, and a thread of C's: it ends the program even while Qt, or a loop, holds Python's lock)\nfaulthandler.dump_traceback_later(float(os.environ.get('INTUACODE_PROBE_TIMEOUT') or 25), exit=True)\nif sys.platform.startswith('linux') and not (os.environ.get('DISPLAY') or os.environ.get('WAYLAND_DISPLAY')):\n    os.environ.setdefault('QT_QPA_PLATFORM', 'offscreen')   # (no screen: laid out all the same)\nimport base64, importlib, json, re, runpy, time, types\n\nMARK = '\\x01INTUACODE-LAYOUT\\x01'\nif len(sys.argv) < 2:\n    sys.exit('usage: probe_qt.py program.py')\nprogram = sys.argv[1]\nsource = open(program, encoding='utf-8', errors='replace').read()\nbinding = next((b for b in ('PySide6', 'PyQt6', 'PyQt5', 'PySide2') if re.search(r'\\b%s\\b' % b, source)), 'PySide6')\nQtWidgets = importlib.import_module(binding + '.QtWidgets')\nQtCore = importlib.import_module(binding + '.QtCore')\n\n\ndef names_in_program():\n    \"\"\"The program's own names for its widgets: module names (win), and an object's (self.status).\"\"\"\n    found = {}\n    main = sys.modules.get('__main__')\n    scope = vars(main) if main else {}\n    for key, value in list(scope.items()):\n        if isinstance(value, QtWidgets.QWidget):\n            found.setdefault(id(value), key)\n    seen = set()\n    def attrs(obj, depth):\n        if id(obj) in seen or depth > 2:\n            return\n        seen.add(id(obj))\n        try:\n            items = list(vars(obj).items())\n        except TypeError:\n            return\n        for k2, v2 in items:\n            if isinstance(v2, QtWidgets.QWidget):\n                found.setdefault(id(v2), k2)\n                attrs(v2, depth + 1)\n    for key, value in list(scope.items()):\n        if not isinstance(value, (type, types.ModuleType)) and not callable(value) or isinstance(value, QtWidgets.QWidget):\n            attrs(value, 0)\n    return found\n\n\ndef report():\n    QtWidgets.QApplication.processEvents()\n    names = names_in_program()\n    origin = QtCore.QPoint(0, 0)\n\n    def text_of(w):\n        for get in ('text', 'title', 'windowTitle'):\n            f = getattr(w, get, None)\n            if callable(f) and get != 'windowTitle':\n                try:\n                    t = f()\n                    if isinstance(t, str):\n                        return t\n                except TypeError:\n                    pass\n        return ''\n\n    def parts_in(w):\n        # (Qt's own insides left out: a list's viewport is what it shows, its scroll bars' holders aren't parts)\n        out = []\n        for c in w.children():\n            if not isinstance(c, QtWidgets.QWidget) or c.isWindow():\n                continue\n            name = c.objectName() or ''\n            if name == 'qt_scrollarea_viewport':\n                out.extend(parts_in(c))\n            elif not name.startswith('qt_'):\n                out.append(c)\n        return out\n\n    def node(w, top):\n        p = w.mapTo(top, origin) if w is not top else origin\n        kids = parts_in(w)\n        return {\n            'type': w.metaObject().className(), 'name': names.get(id(w)), 'id': w.objectName() or None, 'text': text_of(w),\n            'x': p.x(), 'y': p.y(), 'w': w.width(), 'h': w.height(), 'shown': bool(w.isVisible()),\n            'children': [node(c, top) for c in kids],\n        }\n\n    windows = []\n    for top in QtWidgets.QApplication.topLevelWidgets():\n        if not top.isVisible() or isinstance(top, QtWidgets.QMenu):\n            continue\n        picture = None\n        try:\n            buf = QtCore.QBuffer()\n            buf.open(QtCore.QIODevice.OpenModeFlag.WriteOnly if hasattr(QtCore.QIODevice, 'OpenModeFlag') else QtCore.QIODevice.WriteOnly)\n            top.grab().save(buf, 'PNG')\n            picture = base64.b64encode(bytes(buf.data())).decode('ascii')\n        except Exception:\n            picture = None\n        windows.append({'title': top.windowTitle(), 'w': top.width(), 'h': top.height(), 'picture': None, 'pictureData': picture, 'root': node(top, top)})\n    data = {'intuacode': 'layout', 'version': 1, 'toolkit': binding, 'made': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'windows': windows}\n    sys.stdout.write(MARK + json.dumps(data) + MARK + '\\n')\n    sys.stdout.flush()\n    os._exit(0)\n\n\n# the program's QApplication, a little different: when it starts its loop, its windows are measured a moment later\nBase = QtWidgets.QApplication\n\n\ndef out_of_sight():\n    # (shown, see-through and off the screen: its size stays the program's)\n    if os.environ.get('QT_QPA_PLATFORM') == 'offscreen':\n        return\n    for top in QtWidgets.QApplication.topLevelWidgets():\n        if top.isVisible():\n            top.setWindowOpacity(0.0)\n            top.move(-20000, -20000)\n\n\nclass App(Base):\n    # (exec is static in PySide6 and PyQt: called as it would be, with nothing)\n    def exec(self, *a):\n        out_of_sight()\n        QtCore.QTimer.singleShot(400, report)\n        return super().exec(*a)\n\n    def exec_(self, *a):\n        out_of_sight()\n        QtCore.QTimer.singleShot(400, report)\n        return (super().exec_ if hasattr(Base, 'exec_') else super().exec)(*a)\n\n\nQtWidgets.QApplication = App\nsys.argv = sys.argv[1:]\nsys.path.insert(0, os.path.dirname(os.path.abspath(program)))\nrunpy.run_path(program, run_name='__main__')\nsys.stdout.write(MARK + json.dumps({'intuacode': 'layout', 'version': 1, 'toolkit': binding, 'windows': [], 'note': 'The program ended without opening a window (no exec()).'}) + MARK + '\\n')\nsys.stdout.flush()\nos._exit(0)\n";
  G.WX_PROBE = "\"\"\"IntuaCode's layout probe for wxPython: runs the program, and once its windows are shown, reports where every widget\nis (as wx laid it out, inside each window's title bar and borders), then ends. Each window is put out of sight while\nit's measured. Usage:\n    python -u probe_wx.py main.py [its arguments]\nIt prints one line, between two marks, of JSON: IntuaCode's layout report (version 1). A program that never opens a\nwindow, or hangs, is ended after 25 seconds (INTUACODE_PROBE_TIMEOUT), saying where it was on stderr.\"\"\"\nimport faulthandler, os, sys\n# (first, and a thread of C's: it ends the program even while wx, or a loop, holds Python's lock)\nfaulthandler.dump_traceback_later(float(os.environ.get('INTUACODE_PROBE_TIMEOUT') or 25), exit=True)\nimport json, runpy, time, types\nimport wx\n\nMARK = '\\x01INTUACODE-LAYOUT\\x01'\n\n\ndef names_in_program():\n    found = {}\n    main = sys.modules.get('__main__')\n    scope = vars(main) if main else {}\n    for key, value in list(scope.items()):\n        if isinstance(value, wx.Window):\n            found.setdefault(id(value), key)\n    seen = set()\n    def attrs(obj, depth):\n        if id(obj) in seen or depth > 2:\n            return\n        seen.add(id(obj))\n        try:\n            items = list(vars(obj).items())\n        except TypeError:\n            return\n        for k2, v2 in items:\n            if isinstance(v2, wx.Window):\n                found.setdefault(id(v2), k2)\n                attrs(v2, depth + 1)\n    for key, value in list(scope.items()):\n        if isinstance(value, wx.Window) or not (isinstance(value, (type, types.ModuleType)) or callable(value)):\n            attrs(value, 0)\n    # (windows made inside a frame's __init__ and kept only by wx: the frames' own attributes)\n    for top in wx.GetTopLevelWindows():\n        attrs(top, 0)\n    return found\n\n\ndef report():\n    names = names_in_program()\n    windows = []\n    for top in wx.GetTopLevelWindows():\n        if not top.IsShown():\n            continue\n        ox, oy = top.ClientToScreen((0, 0))\n\n        def node(w):\n            if w is top:\n                x, y = 0, 0\n                cw, ch = top.GetClientSize()\n            else:\n                # (from its parent's inside, where its place is said: a box's own border counts as its)\n                sx, sy = w.GetParent().ClientToScreen(w.GetPosition())\n                x, y = sx - ox, sy - oy\n                cw, ch = w.GetSize()\n            kind = w.GetClassName()\n            label = ''\n            try:\n                label = w.GetLabel() or ''\n            except Exception:\n                pass\n            return {\n                'type': kind[2:] if kind.startswith('wx') else kind, 'name': names.get(id(w)), 'id': w.GetName() or None, 'text': label,\n                'x': x, 'y': y, 'w': cw, 'h': ch, 'shown': bool(w.IsShown()),\n                'children': [node(c) for c in w.GetChildren() if not c.IsTopLevel()],\n            }\n        n = node(top)\n        windows.append({'title': top.GetTitle(), 'w': n['w'], 'h': n['h'], 'picture': None, 'root': n})\n    data = {'intuacode': 'layout', 'version': 1, 'toolkit': 'wxPython', 'made': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'windows': windows}\n    sys.stdout.write(MARK + json.dumps(data) + MARK + '\\n')\n    sys.stdout.flush()\n    os._exit(0)\n\n\n# the program's wx.App, a little different: when its loop starts, its windows go out of sight, and are measured\nBase = wx.App\n\n\nclass App(Base):\n    def MainLoop(self, *a):\n        for top in wx.GetTopLevelWindows():\n            try:\n                top.SetTransparent(0)\n            except Exception:\n                pass\n            top.Move((-20000, -20000))\n        wx.CallLater(400, report)\n        return Base.MainLoop(self, *a)\n\n\nwx.App = App\nif len(sys.argv) < 2:\n    sys.exit('usage: probe_wx.py program.py')\nsys.argv = sys.argv[1:]\nsys.path.insert(0, os.path.dirname(os.path.abspath(sys.argv[0])))\nrunpy.run_path(sys.argv[0], run_name='__main__')\nsys.stdout.write(MARK + json.dumps({'intuacode': 'layout', 'version': 1, 'toolkit': 'wxPython', 'windows': [], 'note': 'The program ended without opening a window (no MainLoop).'}) + MARK + '\\n')\nsys.stdout.flush()\nos._exit(0)\n";
  G.QT_PROBE = "#pragma once\n// IntuaCode's layout probe for Qt Widgets (C++). When the app runs with INTUACODE_LAYOUT set to a file's path, a moment\n// after its windows show it writes where every widget is to that file, as IntuaCode's layout report (version 1), with a\n// picture of each window beside it; IntuaCode's Preview then draws the app as it really is. A widget's objectName is its\n// name there (setObjectName(\"add\")), when it has one. Nothing happens, and nothing is written, unless INTUACODE_LAYOUT is\n// set.\n//\n//   1. #include \"IntuaCodeQtProbe.h\" where the main window is shown, and after it's shown:\n//          intuacode::probeQtLayoutSoon();\n//   2. Run the app with INTUACODE_LAYOUT=<the project's folder>/intuacode-layout.json\n//      (and INTUACODE_LAYOUT_QUIT=1 to close it once it has written the report).\n//   3. In IntuaCode, press Measure in the Preview.\n// An app that saves its state when it quits can skip that for a run that's only measured: qtQuitsAfterMeasuring().\n#include <QApplication>\n#include <QAbstractButton>\n#include <QDateTime>\n#include <QDir>\n#include <QFile>\n#include <QFileInfo>\n#include <QGroupBox>\n#include <QJsonArray>\n#include <QJsonDocument>\n#include <QJsonObject>\n#include <QLabel>\n#include <QLineEdit>\n#include <QPixmap>\n#include <QTimer>\n#include <QWidget>\n\nnamespace intuacode {\n\n// This run is only to be measured: it writes the report and quits (INTUACODE_LAYOUT and INTUACODE_LAYOUT_QUIT set).\ninline bool qtQuitsAfterMeasuring() {\n    return qEnvironmentVariableIsSet(\"INTUACODE_LAYOUT\") && qEnvironmentVariableIsSet(\"INTUACODE_LAYOUT_QUIT\");\n}\n\ninline QString qtTextOf(QWidget* w) {\n    if (auto* b = qobject_cast<QAbstractButton*>(w)) return b->text();\n    if (auto* l = qobject_cast<QLabel*>(w)) return l->text();\n    if (auto* e = qobject_cast<QLineEdit*>(w)) return e->text();\n    if (auto* g = qobject_cast<QGroupBox*>(w)) return g->title();\n    return {};\n}\n\n// a widget's parts: its child widgets, Qt's own insides left out (a list's viewport is what it shows)\ninline QList<QWidget*> qtPartsIn(QWidget* w) {\n    QList<QWidget*> out;\n    for (QObject* c : w->children()) {\n        auto* cw = qobject_cast<QWidget*>(c);\n        if (cw == nullptr || cw->isWindow()) continue;\n        const QString name = cw->objectName();\n        if (name == QLatin1String(\"qt_scrollarea_viewport\")) out += qtPartsIn(cw);\n        else if (!name.startsWith(QLatin1String(\"qt_\"))) out += cw;\n    }\n    return out;\n}\n\ninline QJsonObject qtDescribe(QWidget* w, QWidget* top) {\n    QJsonObject o;\n    const QPoint p = (w == top) ? QPoint(0, 0) : w->mapTo(top, QPoint(0, 0));\n    o[\"type\"] = QString::fromLatin1(w->metaObject()->className());\n    o[\"name\"] = w->objectName().isEmpty() ? QJsonValue() : QJsonValue(w->objectName());\n    o[\"id\"] = QJsonValue();\n    o[\"text\"] = qtTextOf(w);\n    o[\"x\"] = p.x();\n    o[\"y\"] = p.y();\n    o[\"w\"] = w->width();\n    o[\"h\"] = w->height();\n    o[\"shown\"] = w->isVisible();\n    QJsonArray children;\n    for (QWidget* c : qtPartsIn(w)) children.append(qtDescribe(c, top));\n    o[\"children\"] = children;\n    return o;\n}\n\n// Every window on the screen: where each widget is, in the window, and a picture of it beside the report.\ninline void writeQtLayout(const QString& path) {\n    const QFileInfo report(path);\n    QJsonArray windows;\n    int i = 0;\n    for (QWidget* top : QApplication::topLevelWidgets()) {\n        if (!top->isVisible() || top->inherits(\"QMenu\")) continue;\n        QJsonObject w;\n        w[\"title\"] = top->windowTitle();\n        w[\"w\"] = top->width();\n        w[\"h\"] = top->height();\n        const QString picture = report.completeBaseName() + \"-\" + QString::number(i++) + \".png\";\n        if (top->grab().save(report.dir().filePath(picture), \"PNG\")) w[\"picture\"] = picture;\n        w[\"root\"] = qtDescribe(top, top);\n        windows.append(w);\n    }\n    QJsonObject o;\n    o[\"intuacode\"] = \"layout\";\n    o[\"version\"] = 1;\n    o[\"toolkit\"] = \"Qt\";\n    o[\"made\"] = QDateTime::currentDateTimeUtc().toString(Qt::ISODate);\n    o[\"windows\"] = windows;\n    QFile f(path);\n    if (f.open(QIODevice::WriteOnly | QIODevice::Truncate)) f.write(QJsonDocument(o).toJson(QJsonDocument::Compact));\n}\n\n// After the main window is shown: measures it a moment later (when it's laid out), if INTUACODE_LAYOUT is set.\ninline void probeQtLayoutSoon(int afterMs = 1500) {\n    const QString path = qEnvironmentVariable(\"INTUACODE_LAYOUT\");\n    if (path.isEmpty()) return;\n    QTimer::singleShot(afterMs, [path] {\n        writeQtLayout(path);\n        if (qtQuitsAfterMeasuring()) QCoreApplication::quit();\n    });\n}\n\n} // namespace intuacode\n";
  G.IMGUI_PROBE = "#pragma once\n// IntuaCode's layout probe for Dear ImGui (1.89.4 or later). When the app runs with INTUACODE_LAYOUT set to a file's\n// path, about half a second after it starts drawing it writes where every window, and every item with an id in it\n// (buttons, fields, sliders, check boxes: not plain Text), is to that file, as IntuaCode's layout report (version 1);\n// IntuaCode's Preview then draws the app as it really is. It sees the items through ImGui's test engine hooks.\n// Nothing is written unless INTUACODE_LAYOUT is set.\n//\n//   1. In your imconfig.h (or before every #include \"imgui.h\"):   #define IMGUI_ENABLE_TEST_ENGINE\n//   2. In one .cpp file:   #define INTUACODE_IMGUI_PROBE_IMPLEMENTATION\n//                          #include \"IntuaCodeImGuiProbe.h\"\n//   3. Each frame, after ImGui::Render():   if (intuacode::imguiProbeFrame()) break;   // (true: written, and quit)\n//   4. Run the app with INTUACODE_LAYOUT=<the project's folder>/intuacode-layout.json\n//      (and INTUACODE_LAYOUT_QUIT=1 for imguiProbeFrame() to say \"quit\" once it's written).\n//   5. In IntuaCode, press Measure in the Preview.\n// (If your app has its own test engine hooks, use them to call intuacode::imguiProbeItem(id, bb, window, label) instead.)\n#include \"imgui.h\"\n#include \"imgui_internal.h\"\n#include <cstdio>\n#include <cstdlib>\n#include <string>\n#include <vector>\n\nnamespace intuacode {\nstruct ImguiProbeItem { ImGuiID id; ImRect bb; ImGuiWindow* window; std::string label; };\nstd::vector<ImguiProbeItem>& imguiProbeItems();\nvoid imguiProbeItem(ImGuiID id, const ImRect& bb, ImGuiWindow* window, const char* label);\nbool imguiProbeFrame();\n} // namespace intuacode\n\n#ifdef INTUACODE_IMGUI_PROBE_IMPLEMENTATION\nnamespace intuacode {\n\nstd::vector<ImguiProbeItem>& imguiProbeItems() { static std::vector<ImguiProbeItem> items; return items; }\n\nvoid imguiProbeItem(ImGuiID id, const ImRect& bb, ImGuiWindow* window, const char* label) {\n    auto& items = imguiProbeItems();\n    for (auto it = items.rbegin(); it != items.rend(); ++it)\n        if (it->id == id) { if (label) it->label = label; return; }\n    if (label == nullptr) items.push_back({ id, bb, window, \"\" });   // (a label for an item not added isn't one)\n}\n\nstatic std::string imguiJson(const std::string& s) {\n    std::string out = \"\\\"\";\n    for (char c : s) {\n        if (c == '\"' || c == '\\\\') { out += '\\\\'; out += c; }\n        else if (static_cast<unsigned char>(c) < 0x20) { char b[8]; std::snprintf(b, sizeof b, \"\\\\u%04x\", c); out += b; }\n        else out += c;\n    }\n    return out + \"\\\"\";\n}\n// what a label shows: before \"##\" (\"Save##file\" shows Save)\nstatic std::string imguiShown(const std::string& l) { const auto at = l.find(\"##\"); return at == std::string::npos ? l : l.substr(0, at); }\n\nbool imguiProbeFrame() {\n    static int frame = 0;\n    static bool written = false;\n    auto& items = imguiProbeItems();\n    const char* path = std::getenv(\"INTUACODE_LAYOUT\");\n    ImGuiContext* ctx = ImGui::GetCurrentContext();\n    if (path == nullptr || ctx == nullptr || written) { items.clear(); return written && std::getenv(\"INTUACODE_LAYOUT_QUIT\") != nullptr; }\n    ctx->TestEngineHookItems = true;   // (ImGui calls the hooks below only while this is on)\n    if (++frame < 30) { items.clear(); return false; }   // (half a second, for its windows to settle)\n    std::string out = \"{\\\"intuacode\\\":\\\"layout\\\",\\\"version\\\":1,\\\"toolkit\\\":\\\"Dear ImGui\\\",\\\"windows\\\":[\";\n    bool firstWindow = true;\n    for (ImGuiWindow* w : ctx->Windows) {\n        if (!w->WasActive || w->Hidden || (w->Flags & (ImGuiWindowFlags_ChildWindow | ImGuiWindowFlags_Tooltip | ImGuiWindowFlags_Popup))) continue;\n        char head[160];\n        std::snprintf(head, sizeof head, \",\\\"w\\\":%d,\\\"h\\\":%d,\\\"root\\\":{\\\"type\\\":\\\"Window\\\",\\\"name\\\":\", (int) w->Size.x, (int) w->Size.y);\n        out += std::string(firstWindow ? \"\" : \",\") + \"{\\\"title\\\":\" + imguiJson(imguiShown(w->Name)) + head + imguiJson(imguiShown(w->Name));\n        std::snprintf(head, sizeof head, \",\\\"text\\\":\\\"\\\",\\\"x\\\":0,\\\"y\\\":0,\\\"w\\\":%d,\\\"h\\\":%d,\\\"shown\\\":true,\\\"children\\\":[\", (int) w->Size.x, (int) w->Size.y);\n        out += head;\n        firstWindow = false;\n        bool firstItem = true;\n        for (const auto& it : items) {\n            if (it.window == nullptr || it.window->RootWindow != w || it.id == w->ID || it.id == w->MoveId) continue;\n            const std::string shown = imguiShown(it.label);\n            char box[160];\n            std::snprintf(box, sizeof box, \",\\\"x\\\":%d,\\\"y\\\":%d,\\\"w\\\":%d,\\\"h\\\":%d,\\\"shown\\\":true,\\\"children\\\":[]}\",\n                (int) (it.bb.Min.x - w->Pos.x), (int) (it.bb.Min.y - w->Pos.y), (int) it.bb.GetWidth(), (int) it.bb.GetHeight());\n            out += std::string(firstItem ? \"\" : \",\") + \"{\\\"type\\\":\\\"Item\\\",\\\"name\\\":\" + (shown.empty() ? std::string(\"null\") : imguiJson(shown)) + \",\\\"text\\\":\" + imguiJson(shown) + box;\n            firstItem = false;\n        }\n        out += \"]}}\";\n    }\n    out += \"]}\";\n    if (FILE* f = std::fopen(path, \"wb\")) { std::fwrite(out.data(), 1, out.size(), f); std::fclose(f); }\n    written = true;\n    items.clear();\n    return std::getenv(\"INTUACODE_LAYOUT_QUIT\") != nullptr;\n}\n\n} // namespace intuacode\n\n// ImGui's test engine hooks (IMGUI_ENABLE_TEST_ENGINE): every item added, with its label\nvoid ImGuiTestEngineHook_ItemAdd(ImGuiContext* ctx, ImGuiID id, const ImRect& bb, const ImGuiLastItemData*) {\n    intuacode::imguiProbeItem(id, bb, ctx->CurrentWindow, nullptr);\n}\nvoid ImGuiTestEngineHook_ItemInfo(ImGuiContext* ctx, ImGuiID id, const char* label, ImGuiItemStatusFlags) {\n    intuacode::imguiProbeItem(id, ImRect(), ctx->CurrentWindow, label);\n}\nvoid ImGuiTestEngineHook_Log(ImGuiContext*, const char*, ...) {}\nconst char* ImGuiTestEngine_FindItemDebugLabel(ImGuiContext*, ImGuiID) { return nullptr; }\n#endif\n";

  G.kits.push(qtPy, qtCpp, wxKit, imKit);
  G.kitParts = { textW, pair, ids, textArg, withInside, share, linesOf, fileOf };
})(typeof window !== 'undefined' ? window : globalThis);

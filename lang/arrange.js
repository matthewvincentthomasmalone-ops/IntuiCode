/* IntuaCode — Editor mode's moves and sizes: something dragged (or resized by its corner) in the Preview, said as a style sentence.
 *
 * In Editor mode the Preview's page can be dragged about. The drag is only a picture of the move. What counts is
 * what the page reports about the element (how it's positioned, and its offsets, as the browser worked them out)
 * and how far it went: they become one style sentence in Styling, and the page is rebuilt from the code. Nothing
 * about a move is kept: the next one reads the page's own numbers again, and the rebuilt page is asked where the
 * element is, so a move is only said to be done when the page shows it there (the app does that part).
 *
 *   offsets(drop)                       -> { props: { position?, left, top } } or { why }
 *       drop: what the page said: { dx, dy, position, left, top } (left and top in px, or null)
 *   sizes(drop)                         -> { props: { width, height, 'aspect-ratio'? }, drop: [props to take out],
 *                                          box: { w, h } (the size the page should then show) } or { why }
 *       drop: { w0, h0, w, h } (the element's size before and as dragged, its border box, in px), padX, padY (its
 *       padding and borders across and down), boxSizing, display, tag, kept (its shape kept), ratio (its
 *       aspect-ratio as the page worked it out, or 'auto')
 *   keepsShape(tag, only)               -> true for what keeps its shape when resized: a page, picture, video or
 *                                          drawing, or a box holding only one of them (only: that one's tag)
 *   ratioOf(r)                          -> a ratio as Styling says it: "3 / 2", "16 / 9", or 1.603
 *   styleWith(line, props, drop)        -> the "style …:" sentence with these offsets and sizes (they replace its
 *                                          own; those in drop are taken out; the rest of it is kept as written)
 *   styleLine(text, result, name)       -> the last sentence at the left edge of Styling that says "style …:" and
 *                                          makes the rule #name, or -1 (result: Styling compiled, its lines' sources)
 *   withMove(text, result, name, props, drop) -> { text, line }: Styling with the move (or size) written in (see
 *                                          withMove for which sentence it goes in)
 *   nameFor(drop, taken)                -> a name for an element that has none: from its text, or what it is
 *       drop: { text, tag }; taken(name) -> true when the name is already used
 *   namings(line, name)                 -> the Structure sentence with the name in it, each way it could be said
 *                                          (the app keeps the first one that compiles to exactly the same page,
 *                                          with only that id added: namedOnly)
 *   namedOnly(before, after, name, line) -> true when the marked page `after` is `before` with id="name" added to
 *                                          the element from that sentence line, and nothing else changed
 *   said(name)                          -> the name as a sentence says it (in quotes when it isn't a plain name)
 *   moved(dx, dy)                       -> "20 right and 10 up"
 *   sized(w, h)                         -> "480 × 320"
 *
 * No page here (no DOM): the app and the tests both use it. Styling's lists are split by lang/web_write.js
 * (IntuiWeb.splitItems), so quotes and brackets keep their commas, as the writer reads them.
 */
(function (root) {
  'use strict';

  const round = (v) => Math.round(Number(v) || 0);
  const num = (v) => (Number.isFinite(v) ? v : 0);

  /* Where the element goes, as offsets. A static element is nudged from its place (position: relative); one that
     is already relative, absolute or fixed keeps its kind, from the offsets the page worked out (so a rule
     elsewhere that set them is counted). Sticky is where it sticks, not where it is: that isn't moved. */
  function offsets(d) {
    const dx = round(d && d.dx), dy = round(d && d.dy), pos = String((d && d.position) || 'static');
    if (!dx && !dy) return { why: 'It wasn\'t moved.' };
    if (pos === 'static') return { props: { position: 'relative', left: dx, top: dy } };
    if (pos === 'relative') return { props: { position: 'relative', left: round(num(d.left) + dx), top: round(num(d.top) + dy) } };
    if (pos === 'absolute' || pos === 'fixed') return { props: { left: round(num(d.left) + dx), top: round(num(d.top) + dy) } };
    if (pos === 'sticky') return { why: 'It sticks in place while the page scrolls (position: sticky), so dragging can\'t move it: its "top" in Styling says where it sticks.' };
    return { why: `It's positioned as ${pos}, which a drag can't be written as.` };
  }

  /* What keeps its shape when resized: what shows something made to a shape (a page, a picture, a video, a drawing),
     and a box holding only one of them (a frame for a page, say). The rest resizes freely (Shift keeps its shape). */
  const SHAPED_TAGS = 'iframe|img|video|canvas|svg|picture|object|embed';   // (the Preview's page keeps the same: the app gives it these)
  const SHAPED = new RegExp(`^(?:${SHAPED_TAGS})$`);
  const keepsShape = (tag, only) => SHAPED.test(String(tag || '')) || (!!only && SHAPED.test(String(only)));
  // (sized in a line of text only when it's one of these: a word's size is its letters')
  const SIZABLE_INLINE = /^(?:img|video|canvas|svg|iframe|object|embed|input|button|select|textarea|audio|meter|progress)$/;

  /* A ratio as Styling says it: a small fraction when one is that ratio (to 0.2%), or the number. */
  function ratioOf(r) {
    if (!(r > 0) || !Number.isFinite(r)) return null;
    for (let q = 1; q <= 32; q++) {
      const p = Math.round(r * q);
      if (p > 0 && Math.abs(p / q - r) <= r * 0.002) return p + ' / ' + q;
    }
    return String(+r.toFixed(3));
  }
  // the ratio in an aspect-ratio the page worked out ("3 / 2", "auto 16 / 9", "1.5"), or null for none ("auto")
  const ratioIn = (v) => {
    const m = String(v || '').match(/([\d.]+)\s*(?:\/\s*([\d.]+))?\s*$/);
    if (!m || /^\s*auto\s*$/.test(String(v || ''))) return null;
    const r = m[2] ? +m[1] / +m[2] : +m[1];
    return r > 0 && Number.isFinite(r) ? r : null;
  };

  /* A resize as sizes. The width (and height) are the content's when the box counts its padding and borders apart
     (box-sizing: content-box, the default), so the box is the size it was dragged to. Its shape kept: the width, and
     the shape as a rule (height: auto, aspect-ratio: the shape it had), so a later width keeps it too; otherwise the
     width and height, and no aspect-ratio. */
  function sizes(d) {
    const w = round(d && d.w), h = round(d && d.h), w0 = round(d && d.w0), h0 = round(d && d.h0);
    if (!(w > 0) || !(h > 0)) return { why: 'It has no size on the page to change.' };
    if (w === w0 && h === h0) return { why: 'It wasn\'t resized.' };
    if (String(d.display || '') === 'inline' && !SIZABLE_INLINE.test(String(d.tag || ''))) {
      return { why: 'It\'s part of a line of text (display: inline), so its size is its words\'. Make it a box first, with "display: inline-block" in its style.' };
    }
    const inner = String(d.boxSizing || 'content-box') === 'border-box', padX = inner ? 0 : num(d.padX), padY = inner ? 0 : num(d.padY);
    const cw = Math.max(1, w - padX);
    if (d.kept) {
      const r = ratioIn(d.ratio) || (w0 - padX > 0 && h0 - padY > 0 ? (w0 - padX) / (h0 - padY) : null);
      const said = ratioOf(r);
      if (!said) return { why: 'It has no shape on the page to keep.' };
      const rr = /\//.test(said) ? said.split('/').map(Number).reduce((a, b) => a / b) : +said;
      return { props: { width: cw, height: 'auto', 'aspect-ratio': said }, drop: [], box: { w: cw + padX, h: Math.round(cw / rr + padY) }, kept: true };
    }
    const ch = Math.max(1, h - padY);
    return { props: { width: cw, height: ch }, drop: ['aspect-ratio'], box: { w: cw + padX, h: ch + padY }, kept: false };
  }

  /* The first colon outside quotes: where a "style …:" sentence's name ends. */
  function colonAt(s) {
    let q = null;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (q) { if (c === '\\') i++; else if (c === q) q = null; }
      else if (c === '"' || c === '\'') q = c;
      else if (c === ':') return i;
    }
    return -1;
  }
  const splitItems = (s) => {
    const W = root.IntuiWeb;
    if (W && W.splitItems) return W.splitItems(s);
    return String(s).split(',').map(p => p.trim()).filter(Boolean);
  };

  // a style's own way of saying each offset, as Styling reads it: "position relative" or "position: relative",
  // "left 20px" or "left: 20px" (a number, a length, or auto)
  const LENGTH = '(?:-?[\\d.]+(?:px|em|rem|%|vw|vh)?|auto)';
  const SAYS = {
    position: /^position\s*:?\s+(?:static|relative|absolute|fixed|sticky)$/i,
    left: new RegExp(`^left\\s*:?\\s+${LENGTH}$`, 'i'),
    top: new RegExp(`^top\\s*:?\\s+${LENGTH}$`, 'i'),
    width: new RegExp(`^width\\s*:?\\s+${LENGTH}$`, 'i'),
    height: new RegExp(`^height\\s*:?\\s+${LENGTH}$`, 'i'),
    'aspect-ratio': /^aspect-ratio\s*:?\s+(?:auto\s+)?(?:[\d.]+\s*(?:\/\s*[\d.]+)?|auto)$/i,
  };
  const KEYS = ['position', 'left', 'top', 'width', 'height', 'aspect-ratio'];
  const OFFSETS = ['position', 'left', 'top'];
  const saysOne = (part, keys) => keys.find(k => SAYS[k].test(part.trim().replace(/\.$/, '')));
  // written the way IntuaCode reads CSS back into sentences ("position: relative, left: 20px, top: -10px")
  const sayProp = (k, v) => `${k}: ${typeof v === 'number' && k !== 'aspect-ratio' ? v + 'px' : v}`;

  function styleWith(line, props, drop = []) {
    const at = colonAt(line);
    if (at < 0) return line;
    const head = line.slice(0, at + 1).replace(/\s+$/, ''), rest = line.slice(at + 1);
    const keys = KEYS.filter(k => props[k] != null);
    const out = [], done = new Set();
    for (const part of rest.trim() ? splitItems(rest) : []) {
      if (saysOne(part, drop)) continue;   // (taken out)
      const k = saysOne(part, keys);
      if (!k) { out.push(part.trim()); continue; }
      if (!done.has(k)) { out.push(sayProp(k, props[k])); done.add(k); }   // in its place; a second one goes
    }
    for (const k of keys) if (!done.has(k)) out.push(sayProp(k, props[k]));
    return head + ' ' + out.join(', ');
  }

  function styleLine(text, result, name) {
    const lines = String(text).split('\n'), rule = '#' + name + ' {';
    let at = -1;
    for (const o of (result && result.lines) || []) {
      if (!(o.src >= 0) || o.text.trim() !== rule) continue;
      const l = lines[o.src] || '';
      if (/^style\s/i.test(l) && colonAt(l) > 0) at = Math.max(at, o.src);
    }
    return at;
  }

  const said = (name) => (/^[a-z][\w-]*$/i.test(name) ? name : '"' + String(name).replace(/["\\]/g, '\\$&') + '"');

  /* Where a move or a size goes: the element's last style sentence, when it's empty (a place IntuaCode made for it),
     already says where it is, or says only where and how big; otherwise a sentence of its own straight after it
     (short, so its numbers are in view to fine-tune; being later, it's the one that counts), or at the end of Styling
     when it has none. (A look that says a width among its colours stays the look: the size goes after it.) */
  function withMove(text, result, name, props, drop = []) {
    const lines = String(text).split('\n');
    let at = styleLine(text, result, name);
    const own = (l) => {
      const c = colonAt(l), rest = l.slice(c + 1), parts = rest.trim() ? splitItems(rest) : [];
      return !parts.length || parts.some(p => saysOne(p, OFFSETS)) || parts.every(p => saysOne(p, KEYS));
    };
    if (at >= 0 && own(lines[at])) lines[at] = styleWith(lines[at], props, drop);
    else {
      if (at >= 0) at++;
      else { at = lines.length; while (at > 0 && !lines[at - 1].trim()) at--; }
      lines.splice(at, 0, styleWith(`style ${said(name)}:`, props, drop));
    }
    return { text: lines.join('\n'), line: at };
  }

  // what an element is, as a name, when it shows no text of its own
  const KIND = { header: 'header', footer: 'footer', section: 'section', nav: 'navigation', main: 'main-area', aside: 'side-panel', article: 'article',
    div: 'box', iframe: 'frame', img: 'picture', video: 'video', audio: 'sound', canvas: 'drawing-area', svg: 'drawing', form: 'form', ul: 'list',
    ol: 'list', li: 'item', p: 'paragraph', h1: 'heading', h2: 'heading', h3: 'heading', h4: 'heading', h5: 'heading', h6: 'heading', button: 'button',
    a: 'link', input: 'box', textarea: 'text-box', select: 'choice', label: 'label', span: 'text', table: 'table', dialog: 'pop-up', hr: 'line' };
  function nameFor(d, taken) {
    const words = String((d && d.text) || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean).slice(0, 3);
    const base = (words.length && /^[a-z]/.test(words[0]) ? words.join('-') : '') || KIND[d && d.tag] || 'part';
    let name = base;
    for (let k = 2; taken(name); k++) name = `${base}-${k}`;
    return name;
  }

  function namings(line, name) {
    const ind = String(line).match(/^\s*/)[0], body = String(line).slice(ind.length);
    // an exact line of HTML: the id goes in its tag
    const exact = body.match(/^((?:html|raw)\s*:\s?<[a-z][\w-]*)(?=[\s>/])/i);
    if (exact) return [ind + exact[1] + ` id="${name}"` + body.slice(exact[1].length)];
    // the text in quotes doesn't count when looking for where its words end (it keeps its length, and its quotes)
    const masked = body.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, (m) => m[0] + '\u0001'.repeat(m.length - 2) + m[0]);
    const groups = masked.search(/\s+in\s+groups?\s/i);
    const stop = masked.search(/["',]|\s+in\s+groups?\s/i);
    const head = stop < 0 ? masked : masked.slice(0, stop);
    const ends = [];
    for (let m, re = /\S+/g; (m = re.exec(head));) ends.push(m.index + m[0].length);
    const out = [];
    // "called name" straight after the words that say what it is: tried from the last of them back ("add a big
    // heading called title "Hi"", "add a button called go saying "Go"")
    for (const e of ends.slice(1).reverse()) out.push(ind + body.slice(0, e) + ' called ' + name + body.slice(e));
    // or as a setting after a comma, before its groups
    out.push(ind + (groups >= 0 ? body.slice(0, groups) + ', with id ' + name + body.slice(groups) : body.replace(/\s+$/, '') + ', with id ' + name));
    return out;
  }

  const escRx = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  function namedOnly(before, after, name, line) {
    const attr = ` id="${name}"`, parts = String(after).split(attr);
    if (parts.length !== 2 || parts.join('') !== String(before)) return false;
    const tag = String(after).match(new RegExp(`<[a-z][\\w-]*\\b[^>]*${escRx(attr)}[^>]*>`, 'i'));
    return !!tag && tag[0].includes(`data-ic-line="${line}"`);
  }

  function moved(dx, dy) {
    const x = round(dx), y = round(dy), out = [];
    if (x) out.push(`${Math.abs(x)} ${x < 0 ? 'left' : 'right'}`);
    if (y) out.push(`${Math.abs(y)} ${y < 0 ? 'up' : 'down'}`);
    return out.join(' and ') || 'nowhere';
  }

  const sized = (w, h) => `${round(w)} × ${round(h)}`;

  const api = { SHAPED_TAGS, offsets, sizes, keepsShape, ratioOf, styleWith, styleLine, withMove, nameFor, namings, namedOnly, said, moved, sized, colonAt };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.IntuiArrange = api;
})(typeof window !== 'undefined' ? window : globalThis);

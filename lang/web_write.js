/* IntuiCode — web language pack: sentences -> HTML, CSS and JavaScript.
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
  const strOf = (s) => { const m = String(s || '').trim().match(STR); return m ? (m[1] ?? m[2]) : null; };

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

  /* Apply fn to the parts of s outside quotes. */
  function outsideQuotes(s, fn) {
    const strs = [];
    const masked = s.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/g, (m) => { strs.push(m); return `\u0001${strs.length - 1}\u0001`; });
    return fn(masked).replace(/\u0001(\d+)\u0001/g, (m, i) => strs[+i]);
  }

  const FILLER = /^(?:(?:please|now|next|then|and then|also|just|i want to|i'd like to|let's|let us|can you|go ahead and|make sure to)\s*,?\s+)+/i;

  /* Shared line machinery: indentation, info per line, output lines with their source line. */
  function makeInfo(lines) { return lines.map((_, i) => ({ line: i, py: [], notes: [], warns: [], errs: [] })); }
  function note(inf, s) { if (!inf.notes.includes(s)) inf.notes.push(s); }

  /* ================================================================== */
  /* HTML: Structure                                                     */
  /* ================================================================== */

  const CONTAINERS = {
    section: 'section', header: 'header', footer: 'footer', 'navigation bar': 'nav', navigation: 'nav', nav: 'nav', 'main area': 'main', main: 'main',
    'main content': 'main', block: 'div', box: 'div', area: 'div', form: 'form', 'side panel': 'aside', sidebar: 'aside', article: 'article', card: 'div',
    list: 'ul', 'numbered list': 'ol', table: 'table', row: 'tr', 'pop-up': 'dialog', dialog: 'dialog',
  };
  const INPUTS = { text: 'text', number: 'number', password: 'password', email: 'email', date: 'date', search: 'search', colour: 'color', color: 'color' };

  function parseHtmlLine(s, inf) {
    let m;
    // groups: "... in group a" / "in groups a, b"
    let groups = [];
    const g = s.match(/\s+in groups?\s+([\w\s,-]+)$/i);
    if (g && !/"[^"]*\bin groups?\b[^"]*"$/.test(s)) { groups = g[1].split(/\s*,\s*|\s+and\s+/).map(toId).filter(Boolean); s = s.slice(0, g.index); }
    const called = (t) => { const c = t.match(/\s+(?:called|named)\s+([\w-]+(?:\s+[\w-]+)?)(?=\s+(?:saying|with|of|described|showing)\b|$)/i); return c ? toId(c[1]) : null; };
    const cut = (t) => t.replace(/\s+(?:called|named)\s+[\w-]+(?:\s+[\w-]+)?(?=\s+(?:saying|with|of|described|showing)\b|$)/i, '');
    const el = (tag, extra = {}) => ({ tag, id: extra.id || null, groups, attrs: extra.attrs || {}, text: extra.text ?? null, container: !!extra.container });

    if ((m = s.match(/^(?:set the page title to|page title is|the page is called|title)\s+(.+)$/i))) {
      const t = strOf(m[1]); if (t == null) inf.errs.push('Put the title in quotes, like: page title is "My shop"');
      note(inf, 'The title shows in the browser tab and in search results.');
      return { title: t || '' };
    }
    if ((m = s.match(/^(?:page language is|the page is in)\s+([\w-]+)$/i))) return { lang: /^[a-z]{2}(?:-[a-z0-9]+)*$/i.test(m[1]) ? m[1] : m[1].toLowerCase().slice(0, 2) };
    if ((m = s.match(/^add\s+(?:a\s+|an\s+)?(big |small |)heading\s+(.+)$/i))) {
      const t = strOf(cut(m[2])); if (t == null) inf.errs.push('Put the heading text in quotes.');
      const tag = { 'big ': 'h1', 'small ': 'h3', '': 'h2' }[m[1].toLowerCase()];
      note(inf, `${code('<' + tag + '>')} is a heading. Use one big heading (h1) per page; screen readers and search engines use headings to understand the page.`);
      return el(tag, { text: t || '', id: called(m[2]) });
    }
    if ((m = s.match(/^add\s+(?:a\s+)?paragraph(?:\s+(?:called|named)\s+([\w-]+))?\s+(.+)$/i))) {
      const t = strOf(m[2]); if (t == null) inf.errs.push('Put the paragraph text in quotes.');
      return el('p', { text: t || '', id: m[1] ? toId(m[1]) : null });
    }
    if ((m = s.match(/^add\s+text\s+(.+)$/i))) return el('span', { text: strOf(m[1]) ?? m[1] });
    if ((m = s.match(/^add\s+(?:a\s+)?button(.*?)\s+(?:saying|that says|labelled|labeled)\s+(.+)$/i))) {
      const t = strOf(m[2]); if (t == null) inf.errs.push('Put the button text in quotes.');
      const id = called(m[1] + ' ') || called(m[1]);
      if (!id) inf.warns.push('Give the button a name ("called save") so Styling and Mechanics can refer to it.');
      return el('button', { text: t || '', id, attrs: { type: 'button' } });
    }
    if ((m = s.match(/^add\s+(?:a\s+)?link(.*?)\s+to\s+("[^"]*"|'[^']*')\s+(?:saying|showing)\s+(.+)$/i))) {
      return el('a', { text: strOf(m[3]) ?? '', id: called(m[1]), attrs: { href: strOf(m[2]) } });
    }
    if ((m = s.match(/^add\s+(?:a\s+)?(?:picture|image|photo)(.*?)\s+of\s+("[^"]*"|'[^']*')(?:\s+described as\s+(.+))?$/i))) {
      const alt = m[3] ? strOf(m[3]) : null;
      if (alt == null) inf.warns.push('Add "described as "…"" so people using screen readers know what the picture shows.');
      return el('img', { id: called(m[1]), attrs: { src: strOf(m[2]), alt: alt ?? '' } });
    }
    if ((m = s.match(/^add\s+(?:a\s+|an\s+)?(big\s+)?(?:(text|number|password|email|date|search|colou?r)\s+)?(?:text\s+)?(?:box|field|input)(.*?)(?:\s+with\s+hint\s+(.+))?$/i))) {
      const id = called(m[3]);
      if (!id) inf.warns.push('Give the box a name ("called email") so Mechanics can read what was typed.');
      const hint = m[4] ? strOf(m[4]) : null;
      if (m[1]) return el('textarea', { id, attrs: hint ? { placeholder: hint } : {}, text: '' });
      return el('input', { id, attrs: { type: INPUTS[(m[2] || 'text').toLowerCase()] || 'text', ...(hint ? { placeholder: hint } : {}) } });
    }
    if ((m = s.match(/^add\s+(?:a\s+)?(?:checkbox|tick box)(.*?)(?:\s+saying\s+(.+))?$/i))) {
      const id = called(m[1]);
      return { tag: 'label', groups, attrs: {}, text: null, id: null, container: false, children: [el('input', { id, attrs: { type: 'checkbox' } })], after: strOf(m[2] || '') || '' };
    }
    if ((m = s.match(/^add\s+(?:a\s+)?(?:drop-?down(?: list)?|menu of choices)(.*?)\s+with\s+(.+)$/i))) {
      const opts = splitItems(m[2]).map(o => strOf(o) ?? o);
      return { ...el('select', { id: called(m[1]) }), children: opts.map(o => ({ tag: 'option', text: o, attrs: {}, groups: [], id: null })) };
    }
    if ((m = s.match(/^add\s+(?:a\s+)?(?:list )?item\s+(.+)$/i))) return el('li', { text: strOf(m[1]) ?? m[1] });
    if ((m = s.match(/^add\s+(?:a\s+)?label\s+(.+?)(?:\s+for\s+([\w-]+))?$/i))) return el('label', { text: strOf(m[1]) ?? m[1], attrs: m[2] ? { for: toId(m[2]) } : {} });
    if ((m = s.match(/^add\s+(?:a\s+)?video(.*?)\s+of\s+("[^"]*")$/i))) return el('video', { id: called(m[1]), attrs: { src: strOf(m[2]), controls: '' } });
    if ((m = s.match(/^add\s+(?:a\s+)?(?:drawing area|canvas)(.*?)(?:\s+(\d+)\s*(?:by|x)\s*(\d+))?$/i))) return el('canvas', { id: called(m[1]), attrs: m[2] ? { width: m[2], height: m[3] } : {} });
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

  function compileHtml(sec, shared) {
    const lines = sec.text.split('\n');
    const info = makeInfo(lines);
    const rootEl = { tag: 'body', children: [], container: true };
    const stack = [{ ind: -1, el: rootEl }];
    let title = 'My page', lang = 'en', bodyAttrs = '', titleSet = false;
    const head = [];
    const all = [];
    lines.forEach((raw, i) => {
      const inf = info[i];
      if (!raw.trim()) return;
      const ind = raw.match(/^ */)[0].length;
      let hm;
      if ((hm = raw.trim().match(/^(?:in the )?head\s*:\s?(.*)$/i))) { head.push({ text: hm[1], src: i }); note(inf, 'HTML copied exactly into the page\'s <head>: the part browsers read first (links, settings), not shown on the page.'); return; }
      if ((hm = raw.trim().match(/^(?:the )?(?:page )?body (?:attributes|has)\s*:\s?(.*)$/i))) { bodyAttrs = hm[1].trim(); note(inf, 'Attributes copied exactly onto the page\'s <body> tag.'); inf.target = 'body'; return; }
      if (/^(?:no title|the page has no title)$/i.test(raw.trim())) { title = null; return; }
      const rawLine = raw.trim().match(/^(?:html|raw)\s*:\s?(.*)$/i);
      let s = rawLine ? raw.trim() : raw.trim().replace(/[.:]$/, '');
      if (/^(?:note|comment)\s*:/i.test(s)) { stack[stack.length - 1].el.children.push({ comment: s.replace(/^(?:note|comment)\s*:\s*/i, ''), src: i }); return; }
      const lead = s.match(FILLER);
      if (lead && lead[0].length < s.length) { note(inf, `Left out filler: "${lead[0].trim()}".`); s = s.slice(lead[0].length); }
      while (stack.length > 1 && ind <= stack[stack.length - 1].ind) stack.pop();
      const parent = stack[stack.length - 1];
      if (parent.el !== rootEl && !parent.el.container) inf.errs.push('This line is indented under something that can\'t hold other things. Only sections, blocks, lists, forms and similar can.');
      const el = parseHtmlLine(s, inf);
      if (!el) {
        inf.errs.push('I don\'t recognise this sentence. Open the Index to see what Structure understands, or start the line with html: to write HTML directly.');
        return;
      }
      if (el.title != null) { title = el.title; inf.target = 'title'; return; }
      if (el.lang) { lang = el.lang; return; }
      el.src = i;
      if (el.id) {
        if (shared.ids[el.id] && shared.ids[el.id].line !== i) inf.errs.push(`Another element is already called ${code(el.id)} (line ${shared.ids[el.id].line + 1}). Names must be unique on a page.`);
        else shared.ids[el.id] = { tag: el.tag, line: i };
        note(inf, `Named ${code(el.id)} (its HTML id). Styling and Mechanics can use this name.`);
      }
      for (const g of el.groups || []) { shared.groups[g] = true; note(inf, `In group ${code(g)} (an HTML class), so styles for that group apply to it.`); }
      if (el.tag === 'li' && !/^(ul|ol)$/.test(parent.el.tag)) inf.warns.push('List items belong inside a list. Indent this under "add a list".');
      if (el.tag === 'button' && parent.el.tag === 'form') { el.attrs.type = 'submit'; note(inf, 'Inside a form, this button sends the form (type="submit"). Handle it in Mechanics with "when … is sent".'); }
      parent.el.children.push(el);
      all.push(el);
      if (el.container) { el.children = []; stack.push({ ind, el }); }
    });
    // groups added from Styling ("save belongs to group primary")
    for (const [id, gs] of Object.entries(shared.addGroups)) {
      const el = all.find(e => e.id === id);
      if (el) for (const g of gs) if (!el.groups.includes(g)) el.groups.push(g);
    }
    // render
    const out = [];
    const push = (text, src) => out.push({ text, src });
    push('<!DOCTYPE html>', -1);
    push(`<html lang="${lang}">`, -1);
    push('<head>', -1);
    push('  <meta charset="utf-8">', -1);
    push('  <meta name="viewport" content="width=device-width, initial-scale=1">', -1);
    const ti = info.findIndex(x => x.target === 'title');
    if (title != null) push(`  <title>${esc(title)}</title>`, ti);
    for (const h of head) push('  ' + h.text, h.src);
    push('  <link rel="stylesheet" href="style.css">', -1);
    push('</head>', -1);
    push(`<body${bodyAttrs ? ' ' + bodyAttrs : ''}>`, info.findIndex(x => x.target === 'body'));
    const attrs = (e) => {
      let a = '';
      if (e.id) a += ` id="${e.id}"`;
      if (shared.mark && e.src != null && e.src >= 0) a += ` data-ic-line="${e.src}"`;
      if (e.groups && e.groups.length) a += ` class="${e.groups.join(' ')}"`;
      for (const [k, v] of Object.entries(e.attrs || {})) a += v === '' && k !== 'alt' ? ` ${k}` : ` ${k}="${escAttr(v)}"`;
      return a;
    };
    const VOID = new Set(['img', 'input', 'hr', 'br', 'meta', 'link']);
    const render = (e, depth) => {
      const pad = '  '.repeat(depth);
      if (e.comment != null) return push(`${pad}<!-- ${esc(e.comment)} -->`, e.src);
      if (e.raw != null) return push(pad + e.raw, e.src);
      if (VOID.has(e.tag)) return push(`${pad}<${e.tag}${attrs(e)}>`, e.src);
      if (e.children && e.children.length && (e.container || e.tag === 'label' || e.tag === 'select')) {
        push(`${pad}<${e.tag}${attrs(e)}>`, e.src);
        for (const c of e.children) render({ ...c, src: c.src ?? e.src }, depth + 1);
        if (e.after) push(`${pad}  ${esc(e.after)}`, e.src);
        push(`${pad}</${e.tag}>`, e.src);
      } else push(`${pad}<${e.tag}${attrs(e)}>${esc(e.text ?? '')}</${e.tag}>`, e.src);
    };
    for (const c of rootEl.children) render(c, 1);
    push('  <script src="script.js"></script>', -1);
    push('</body>', -1);
    push('</html>', -1);
    out.forEach((o, idx) => { if (o.src >= 0) info[o.src].py.push(idx); });
    return { lines: out, info, text: out.map(o => o.text).join('\n') + '\n', title };
  }

  /* ================================================================== */
  /* CSS: Styling                                                        */
  /* ================================================================== */

  const NAMED = new Set(['black', 'white', 'red', 'green', 'blue', 'yellow', 'orange', 'purple', 'pink', 'grey', 'gray', 'brown', 'navy', 'teal', 'transparent', 'gold', 'silver', 'crimson', 'coral', 'salmon', 'tomato', 'turquoise', 'violet', 'indigo', 'lime', 'olive', 'maroon', 'beige', 'ivory', 'lavender', 'tan', 'khaki', 'aqua', 'cyan', 'magenta', 'lightgrey', 'darkgrey', 'whitesmoke', 'skyblue', 'hotpink']);
  const TAG_WORDS = { buttons: 'button', button: 'button', headings: 'h1, h2, h3', heading: 'h1, h2, h3', 'big headings': 'h1', links: 'a', link: 'a', paragraphs: 'p', paragraph: 'p', pictures: 'img', images: 'img', 'text boxes': 'input, textarea', inputs: 'input', lists: 'ul, ol', 'list items': 'li', sections: 'section', 'the page': 'body', page: 'body', everything: '*', header: 'header', footer: 'footer', 'navigation bar': 'nav', forms: 'form', labels: 'label' };
  const CSS_MORE = 'accent-color align-content all animation-delay animation-direction animation-duration animation-fill-mode animation-iteration-count animation-name animation-timing-function appearance backface-visibility background-attachment background-blend-mode background-clip background-origin background-repeat block-size border-bottom-color border-bottom-left-radius border-bottom-right-radius border-bottom-style border-bottom-width border-collapse border-image border-left-color border-left-style border-left-width border-right-color border-right-style border-right-width border-spacing border-style border-top-color border-top-left-radius border-top-right-radius border-top-style border-top-width border-width caption-side caret-color clear clip-path color-scheme column-count column-gap columns content counter-increment counter-reset direction empty-cells fill flex-basis flex-flow flex-grow flex-shrink float font-feature-settings font-variant font-variant-numeric grid grid-area grid-auto-columns grid-auto-flow grid-auto-rows grid-column grid-column-end grid-column-start grid-gap grid-row grid-row-end grid-row-start grid-template grid-template-areas hyphens image-rendering inline-size inset isolation justify-items justify-self list-style-image list-style-position list-style-type margin-block margin-inline mask max-block-size max-inline-size min-block-size min-inline-size mix-blend-mode object-position order outline-color outline-offset outline-style outline-width overflow-wrap overflow-x overflow-y overscroll-behavior padding-block padding-inline perspective place-content place-items place-self pointer-events quotes resize rotate row-gap scale scroll-behavior scroll-margin scroll-padding scroll-snap-align scroll-snap-type scrollbar-color scrollbar-width stroke stroke-width tab-size table-layout text-align-last text-decoration-color text-decoration-line text-decoration-style text-decoration-thickness text-indent text-overflow text-rendering text-shadow text-underline-offset touch-action transform-origin transition-delay transition-duration transition-property transition-timing-function translate user-select vertical-align will-change word-break word-spacing word-wrap writing-mode'.split(' ');
  const HTML_TAGS = new Set('a abbr address article aside audio b blockquote body button canvas caption code dd details dialog div dl dt em fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 header hr html i iframe img input kbd label legend li main mark menu nav ol optgroup option output p picture pre progress q s section select small span strong sub summary sup svg table tbody td textarea tfoot th thead time tr u ul video'.split(' '));
  const CSS_PROPS = new Set([...CSS_MORE, 'align-items', 'align-self', 'animation', 'aspect-ratio', 'background', 'background-color', 'background-image', 'background-position', 'background-size', 'border', 'border-bottom', 'border-color', 'border-left', 'border-radius', 'border-right', 'border-top', 'bottom', 'box-shadow', 'box-sizing', 'color', 'cursor', 'display', 'flex', 'flex-direction', 'flex-wrap', 'font', 'font-family', 'font-size', 'font-style', 'font-weight', 'gap', 'grid-template-columns', 'grid-template-rows', 'height', 'justify-content', 'left', 'letter-spacing', 'line-height', 'list-style', 'margin', 'margin-bottom', 'margin-left', 'margin-right', 'margin-top', 'max-height', 'max-width', 'min-height', 'min-width', 'object-fit', 'opacity', 'outline', 'overflow', 'padding', 'padding-bottom', 'padding-left', 'padding-right', 'padding-top', 'position', 'right', 'text-align', 'text-decoration', 'text-transform', 'top', 'transform', 'transition', 'visibility', 'white-space', 'width', 'z-index', 'filter', 'backdrop-filter']);
  const isCssProp = (p) => CSS_PROPS.has(p) || /^-(?:webkit|moz|ms)-[a-z-]+$/.test(p) || /^--[a-z0-9-]+$/.test(p);

  function color(v, inf) {
    v = v.trim();
    const mv = v.match(/^(?:the colou?r|shared colou?r)\s+([\w-]+)$/i);
    if (mv) return `var(--${toId(mv[1])})`;
    if (/^#/.test(v)) {
      if (!/^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v)) {
        inf.errs.push(`${code(v)} isn't a colour code. Hex colours use only 0-9 and a-f, with 3 or 6 of them after the #, like #1a2b3c.`);
        return v;
      }
      return v.toLowerCase();
    }
    if (/^(rgb|rgba|hsl|hsla)\(/i.test(v) || /^var\(/.test(v)) return v;
    const w = v.toLowerCase().replace(/\s+/g, '');
    if (NAMED.has(w) || /^(light|dark)?(grey|gray|blue|green|red)$/.test(w)) return w.replace('grey', 'gray');
    inf.errs.push(`I don't know the colour ${code(v)}. Use a name like navy, or a code like #1a2b3c.`);
    return v;
  }
  const unit = (v, inf) => /^-?\d+(\.\d+)?$/.test(v.trim()) ? (v.trim() === '0' ? '0' : (note(inf, 'Numbers without a unit are taken as pixels (px).'), v.trim() + 'px')) : v.trim();
  function withAlpha(c, pct) {
    const h = c.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (!h) return null;
    let x = h[1]; if (x.length === 3) x = x.split('').map(d => d + d).join('');
    return `rgba(${parseInt(x.slice(0, 2), 16)}, ${parseInt(x.slice(2, 4), 16)}, ${parseInt(x.slice(4, 6), 16)}, ${+(1 - pct / 100).toFixed(2)})`;
  }

  /* "background navy, rounded corners 8, shadow" -> [[prop, value], ...] */
  function cssProps(text, inf) {
    const out = [];
    for (let part of splitItems(outsideQuotes(text, (t) => t.replace(/\s+and\s+(?=[a-z])/gi, ', ')))) {
      part = part.trim().replace(/\.$/, '');
      let m;
      if ((m = part.match(/^(-{0,2}[a-z][a-z0-9-]*)\s*:\s+(.+)$/i)) && isCssProp(m[1].toLowerCase())) { out.push([m[1].toLowerCase(), m[2].trim()]); note(inf, `${code(m[1])} is written as plain CSS.`); continue; }
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
      if ((m = part.match(/^(?:text colou?r|colou?r|text)\s+(.+)$/i)) && !/^(size|centred|centered|bold)/i.test(m[1])) { out.push(['color', color(m[1], inf)]); continue; }
      if ((m = part.match(/^(?:text size|font size|size of text)\s+(.+)$/i))) { out.push(['font-size', unit(m[1], inf)]); continue; }
      if (/^bold( text)?$/i.test(part)) { out.push(['font-weight', 'bold']); continue; }
      if (/^italic( text)?$/i.test(part)) { out.push(['font-style', 'italic']); continue; }
      if (/^(?:capitals|all capitals|uppercase)( text)?$/i.test(part)) { out.push(['text-transform', 'uppercase']); continue; }
      if ((m = part.match(/^font\s+(.+)$/i))) { const f = m[1].replace(/^["']|["']$/g, ''); out.push(['font-family', `"${f}", sans-serif`]); continue; }
      if ((m = part.match(/^(?:space inside|padding|inner space)\s+(.+)$/i))) { out.push(['padding', m[1].split(/\s+/).map(v => unit(v, inf)).join(' ')]); continue; }
      if ((m = part.match(/^(?:space around|margin|outer space)\s+(.+)$/i))) { out.push(['margin', m[1].split(/\s+/).map(v => unit(v, inf)).join(' ')]); continue; }
      if (/^(?:centred|centered|in the middle)$/i.test(part)) { out.push(['margin-left', 'auto'], ['margin-right', 'auto']); note(inf, 'Centring a block uses automatic space on its left and right. It needs a width or max-width to have an effect.'); continue; }
      if (/^(?:centre|center) the text|^(?:centred|centered) text$/i.test(part)) { out.push(['text-align', 'center']); continue; }
      if ((m = part.match(/^rounded corners?(?:\s+(.+))?$/i))) { out.push(['border-radius', m[1] ? unit(m[1], inf) : '8px']); continue; }
      if (/^(?:round|circle|circular)$/i.test(part)) { out.push(['border-radius', '50%']); continue; }
      if (/^no border$/i.test(part)) { out.push(['border', 'none']); continue; }
      if ((m = part.match(/^border(?:\s+(\S+))?(?:\s+(.+))?$/i))) { out.push(['border', `${m[1] ? unit(m[1], inf) : '1px'} solid ${m[2] ? color(m[2], inf) : 'currentColor'}`]); continue; }
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
      if ((m = part.match(/^(width|height)\s+(.+)$/i))) { out.push([m[1].toLowerCase(), unit(m[2], inf)]); continue; }
      if ((m = part.match(/^at most\s+(.+?)\s+wide$/i))) { out.push(['max-width', unit(m[1], inf)]); continue; }
      if ((m = part.match(/^at least\s+(.+?)\s+tall$/i))) { out.push(['min-height', unit(m[1], inf)]); continue; }
      if (/^(?:in a row|side by side)$/i.test(part)) { out.push(['display', 'flex'], ['align-items', 'center']); note(inf, '`display: flex` lines the contents up in a row. It adapts to screen size, unlike fixed positions.'); continue; }
      if (/^(?:in a column|stacked)$/i.test(part)) { out.push(['display', 'flex'], ['flex-direction', 'column']); continue; }
      if ((m = part.match(/^in a grid of (\d+) columns?$/i))) { out.push(['display', 'grid'], ['grid-template-columns', `repeat(${m[1]}, 1fr)`]); continue; }
      if ((m = part.match(/^(?:gap|space between)\s+(.+)$/i))) { out.push(['gap', unit(m[1], inf)]); continue; }
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
      if ((m = part.match(/^(-?[a-z-]+)\s*:?\s+(.+)$/i)) && isCssProp(m[1].toLowerCase())) { out.push([m[1].toLowerCase(), m[2].trim()]); note(inf, `${code(m[1])} is written as plain CSS.`); continue; }
      inf.errs.push(`I don't know the style "${part}". Open the Index for style words, or write a CSS property like "letter-spacing 2px".`);
    }
    return out;
  }

  function selectorFor(name, shared, inf) {
    let n = name.trim(), m;
    if (/^[.#:*\[]|[>~+]/.test(n) || /^[a-z]+[.#:]/.test(n)) { note(inf, `${code(n)} is a CSS selector written directly.`); return n; }
    if ((m = n.match(/^group\s+(.+)$/i))) return '.' + toId(m[1]);
    if ((m = n.match(/^(?:the element|element)\s+(.+)$/i))) return '#' + toId(m[1]);
    if ((m = n.match(/^every\s+(.+)$/i))) n = m[1];
    const low = n.toLowerCase();
    if (TAG_WORDS[low]) return TAG_WORDS[low];
    const id = toId(n);
    if (shared.ids[id]) return '#' + id;
    if (shared.groups[id] || shared.cssGroups[id]) return '.' + id;
    if (HTML_TAGS.has(low)) return low;
    if (/^[a-z0-9]+(?:\s*,\s*[a-z0-9]+)+$/.test(low) && low.split(/\s*,\s*/).every(t => HTML_TAGS.has(t))) return low.split(/\s*,\s*/).join(', ');
    inf.warns.push(`Nothing on the page is called ${code(id)} yet. Add it in Structure, or write "group ${n}" to style a group.`);
    return '#' + id;
  }

  function compileCss(sec, shared) {
    const lines = sec.text.split('\n');
    const info = makeInfo(lines);
    const out = [];
    const push = (text, src) => out.push({ text, src });
    const rules = [];   // {sel, props, media, src}
    const vars = [];
    let media = null, mediaInd = -1;
    // first pass: groups defined here
    for (const raw of lines) { const g = raw.trim().match(/^(?:create|make) (?:a )?group\s+(.+?)\s*:/i); if (g) shared.cssGroups[toId(g[1])] = true; }
    lines.forEach((raw, i) => {
      const inf = info[i];
      if (!raw.trim()) return;
      const ind = raw.match(/^ */)[0].length;
      let s = raw.trim();
      const lead = s.match(FILLER);
      if (lead && lead[0].length < s.length) { note(inf, `Left out filler: "${lead[0].trim()}".`); s = s.slice(lead[0].length); }
      if (media && ind <= mediaInd) media = null;
      let m;
      if ((m = s.match(/^(?:note|comment)\s*:\s*(.*)$/i))) { rules.push({ comment: m[1], src: i, media }); return; }
      if ((m = s.match(/^(?:css|raw)\s*:\s?(.*)$/i))) { rules.push({ raw: m[1], src: i, media }); return; }
      if ((m = s.match(/^on (?:screens|phones|devices) (narrower|smaller|wider|bigger) than\s+(\S+?)\s*:?$/i))) {
        const w = unit(m[2], inf);
        media = /narrower|smaller/i.test(m[1]) ? `(max-width: ${w})` : `(min-width: ${w})`;
        mediaInd = ind;
        note(inf, `Styles indented under this only apply ${/narrower|smaller/i.test(m[1]) ? 'on screens up to' : 'on screens at least'} ${w} wide (a media query).`);
        inf.media = true;
        return;
      }
      if (/^in dark mode\s*:?$/i.test(s)) { media = '(prefers-color-scheme: dark)'; mediaInd = ind; inf.media = true; note(inf, 'Styles indented under this apply when the device is set to dark mode.'); return; }
      if ((m = s.match(/^(?:shared|main) colou?r\s+([\w-]+)\s+is\s+(.+)$/i))) {
        vars.push([`--${toId(m[1])}`, color(m[2], inf), i]);
        note(inf, `A shared colour (a CSS variable). Use it anywhere as "the colour ${toId(m[1])}"; change it here to change it everywhere.`);
        return;
      }
      if ((m = s.match(/^([\w\s-]+?)\s+(?:belongs to|is in|joins)\s+group\s+(.+)$/i))) {
        const id = toId(m[1]), g = toId(m[2]);
        (shared.addGroups[id] = shared.addGroups[id] || []).push(g);
        shared.cssGroups[g] = true;
        if (!shared.ids[id]) inf.errs.push(`Nothing in Structure is called ${code(id)}.`);
        else note(inf, `Adds group ${code(g)} (a class) to ${code(id)} in Structure, so the group's styles apply to it.`);
        inf.crossFile = 'structure';
        return;
      }
      if ((m = s.match(/^(?:create|make)\s+(?:a\s+)?group\s+(.+?)\s*:\s*(.+)$/i))) {
        const sel = '.' + toId(m[1]);
        note(inf, `A group is a CSS class: ${code(sel)}. Put things in it with "${toId(m[1])} belongs to group …" or "in group …" in Structure.`);
        rules.push({ sel, props: cssProps(m[2], inf), media, src: i });
        return;
      }
      if ((m = s.match(/^when\s+(.+?)\s+is\s+(hovered|pointed at|clicked|focused|selected)\s*:\s*(.+)$/i))) {
        const pseudo = { hovered: ':hover', 'pointed at': ':hover', clicked: ':active', focused: ':focus', selected: ':checked' }[m[2].toLowerCase()];
        rules.push({ sel: selectorFor(m[1], shared, inf) + pseudo, props: cssProps(m[3], inf), media, src: i });
        note(inf, `${code(pseudo)} applies these styles only ${m[2].toLowerCase() === 'hovered' || m[2].toLowerCase() === 'pointed at' ? 'while the mouse is over it' : 'while it is ' + m[2].toLowerCase()}.`);
        return;
      }
      if ((m = s.match(/^(?:style|make|give)\s+(.+?)\s*:\s*(.+)$/i))) {
        rules.push({ sel: selectorFor(m[1], shared, inf), props: cssProps(m[2], inf), media, src: i });
        return;
      }
      inf.errs.push('I don\'t recognise this sentence. Styling sentences start like "style save: …", "create group card: …" or "on screens narrower than 600: …".');
    });
    if (vars.length) {
      push(':root {', vars[0][2]);
      for (const [k, v, src] of vars) push(`  ${k}: ${v};`, src);
      push('}', vars[0][2]);
      push('', -1);
    }
    let curMedia = null;
    const close = () => { if (curMedia) { push('}', -1); push('', -1); curMedia = null; } };
    for (const r of rules) {
      if (r.media !== curMedia) { close(); if (r.media) { push(`@media ${r.media} {`, r.src); curMedia = r.media; } }
      const pad = curMedia ? '  ' : '';
      if (r.comment != null) { push(`${pad}/* ${r.comment} */`, r.src); continue; }
      if (r.raw != null) { push(pad + r.raw, r.src); continue; }
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

  function jsExpr(src, x, inf) {
    let s = String(src || '').trim();
    if (!s) { inf.errs.push('Something is missing here: a value.'); return 'null'; }
    const strs = [];
    let q = s.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/g, (m) => { strs.push(m); return ` ⟦${strs.length - 1}⟧ `; });
    const OPD = String.raw`(?:⟦\d+⟧|-?\d+(?:\.\d+)?|[A-Za-z_$][\w$]*(?:\.[\w$]+)*(?:\([^()]*\)|\[[^\[\]]*\])*)`;
    const R = (p) => new RegExp(p.replace(/OPD/g, OPD), 'gi');
    q = q.replace(/\bthe\b/gi, ' ');
    q = q.replace(R(String.raw`\btext of ([\w-]+)`), (m, id) => { const t = x.shared.ids[toId(id)]; return t ? `document.getElementById("${toId(id)}").${/^(input|textarea|select)$/.test(t.tag) ? 'value' : 'textContent'}` : m; });
    q = q.replace(R(String.raw`\bfirst item (?:of|in) (OPD)`), '$1[0]').replace(R(String.raw`\blast item (?:of|in) (OPD)`), '$1[$1.length - 1]');
    q = q.replace(R(String.raw`\bitem (OPD) (?:of|in) (OPD)`), '$2[$1]');
    q = q.replace(R(String.raw`\b(?:length|size) of (OPD)`), '$1.length').replace(R(String.raw`\bhow many (?:items )?in (OPD)`), '$1.length');
    q = q.replace(R(String.raw`\brandom (?:whole )?number (?:from|between) (OPD) (?:to|and) (OPD)`), (m, a, b) => { note(inf, '`Math.random()` gives a decimal from 0 to 1; multiplying and rounding down turns it into a whole number between the two ends, both included.'); return `(Math.floor(Math.random() * (${b} - ${a} + 1)) + ${a})`; });
    q = q.replace(R(String.raw`\brandom item (?:from|of|in) (OPD)`), '$1[Math.floor(Math.random() * $1.length)]');
    q = q.replace(R(String.raw`(OPD) as (?:a )?number\b`), 'Number($1)').replace(R(String.raw`(OPD) as text\b`), 'String($1)');
    q = q.replace(R(String.raw`(OPD) in (?:capitals|uppercase)\b`), '$1.toUpperCase()').replace(R(String.raw`(OPD) in lowercase\b`), '$1.toLowerCase()');
    q = q.replace(R(String.raw`(OPD) contains (OPD)`), '$1.includes($2)');
    q = q.replace(R(String.raw`(OPD) is (?:in|one of) (OPD)`), '$2.includes($1)');
    q = q.replace(/\ban empty list\b|\bempty list\b/gi, '[]').replace(/\bempty text\b/gi, '""');
    for (const [re, to] of JS_WORDS) q = q.replace(re, to);
    q = q.replace(/(^|[^=!<>])=(?!=)/g, (m, a) => (x.cond ? a + ' === ' : m));
    // inputs of little functions written in the value (t => t.done, (a, b) => a - b) are names too
    const params = new Set();
    for (const mm of q.matchAll(/(?:\(([^()]*)\)|([A-Za-z_$][\w$]*))\s*=>/g)) (mm[1] ?? mm[2]).split(',').map(p => p.trim().replace(/\s*=.*$/, '')).filter(Boolean).forEach(p => params.add(p));
    // names: page elements used bare become the element
    q = q.replace(/(?<![\w$.⟦])([A-Za-z_$][\w$-]*)(?![\w$⟧])/g, (m, id, off) => {
      if (params.has(id)) return id;
      if (/^(true|false|null|undefined|Math|Number|String|document|window|console|JSON|Date|localStorage|this|new|typeof|await|async|function|return)$/.test(id)) return id;
      if (x.vars.has(id) || x.fns.has(id)) return id;
      const el = x.shared.ids[toId(id)];
      if (el && !x.vars.has(id)) return `document.getElementById("${toId(id)}")`;
      if (x.pass2 && !/^\d/.test(id) && !/^\s*\(/.test(q.slice(off + m.length))) inf.warns.push(`${code(id)} hasn't been set anywhere yet.`);
      return id;
    });
    q = q.replace(/\s+/g, ' ').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')').replace(/\s+,/g, ',').replace(/!\s+/g, '!').replace(/\s*\.\s*(?=length)/g, '.').trim();
    q = q.replace(/⟦(\d+)⟧/g, (m, i) => {
      const str = strs[+i];
      if (str[0] === '"' && /\{[^{}]+\}/.test(str)) {
        note(inf, 'Text with {…} inside becomes a template string (backticks): JavaScript fills in the current values.');
        return '`' + str.slice(1, -1).replace(/`/g, '\\`').replace(/\{([^{}]+)\}/g, (mm, e) => '${' + jsExpr(e, x, inf) + '}') + '`';
      }
      return str;
    });
    return q;
  }

  function elementRef(name, x, inf) {
    const id = toId(name);
    const el = x.shared.ids[id];
    if (!el) { inf.errs.push(`Nothing in Structure is called ${code(id)}. Add it there first, e.g. "add a button called ${id} saying "…"".`); }
    return { js: `document.getElementById("${id}")`, id, tag: el ? el.tag : null };
  }

  function compileJs(sec, shared) {
    const lines = sec.text.split('\n');
    const info = makeInfo(lines);
    const out = [];
    const push = (text, src) => out.push({ text, src });
    const x = { shared, vars: new Set(), fns: new Set(), pass2: false, cond: false };
    // pass 1: names
    for (const raw of lines) {
      const s = raw.trim();
      let m;
      if ((m = s.match(/^(?:set|let|make)\s+([A-Za-z_$][\w$]*)\s+(?:to|be)\s/i)) || (m = s.match(/^constant\s+([A-Za-z_$][\w$]*)\s/i))) x.vars.add(m[1]);
      if ((m = s.match(/^(?:create|make)\s+(?:an?\s+)?(?:empty\s+)?list\s+(?:called\s+)?([A-Za-z_$][\w$]*)/i))) x.vars.add(m[1]);
      if ((m = s.match(/\band store (?:it |the reply )?in\s+([A-Za-z_$][\w$]*)$/i))) x.vars.add(m[1]);
      if ((m = s.match(/^for each\s+([A-Za-z_$][\w$]*)\s+in\s/i))) x.vars.add(m[1]);
      if ((m = s.match(/^define\s+([A-Za-z_$][\w$]*)(?:\s+using\s+(.+))?$/i))) { x.fns.add(m[1]); if (m[2]) m[2].split(/\s*,\s*/).forEach(p => x.vars.add(p)); }
      if ((m = s.match(/^(?:js|javascript|raw)\s*:(.*)$/i))) {
        for (const d of m[1].matchAll(/\b(?:let|const|var)\s+([A-Za-z_$][\w$]*)/g)) x.vars.add(d[1]);
        for (const d of m[1].matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)/g)) x.vars.add(d[1]);
      }
    }
    x.pass2 = true;
    const declared = [new Set()];     // one set of names per block, like let
    declared.has = (n) => declared.some(d => d.has(n));
    declared.add = (n) => declared[declared.length - 1].add(n);
    const stack = [];   // {ind, close, kind}
    const E = (t, inf, cond) => { x.cond = !!cond; const r = jsExpr(t, x, inf); x.cond = false; return r; };
    const usesEvent = (fromIdx) => { // does the block starting after this line use the event?
      const baseInd = lines[fromIdx].match(/^ */)[0].length;
      for (let j = fromIdx + 1; j < lines.length; j++) { if (!lines[j].trim()) continue; if (lines[j].match(/^ */)[0].length <= baseInd) break; if (/\bevent\b/.test(lines[j].replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, ''))) return true; }
      return false;
    };
    const needsAsync = (fromIdx) => { // does the block starting after this line use fetch?
      const baseInd = lines[fromIdx].match(/^ */)[0].length;
      for (let j = fromIdx + 1; j < lines.length; j++) { if (!lines[j].trim()) continue; if (lines[j].match(/^ */)[0].length <= baseInd) break; if (/\b(fetch|send .+ to)\b/i.test(lines[j])) return true; }
      return false;
    };
    lines.forEach((raw, i) => {
      const inf = info[i];
      if (!raw.trim()) { push('', i); return; }
      const ind = raw.match(/^ */)[0].length;
      while (stack.length && ind <= stack[stack.length - 1].ind) {
        const b = stack.pop();
        const nextIsElse = /^\s*(otherwise|else)\b/i.test(raw) && ind === b.ind && b.kind === 'if';
        if (nextIsElse) { stack.push(b); declared[declared.length - 1] = new Set(); break; }
        declared.pop();
        while (out.length && out[out.length - 1].text === '') out.pop();
        push('  '.repeat(stack.length) + b.close, b.src);
      }
      const pad = '  '.repeat(stack.length);
      const open = (head, close, kind) => { push(pad + head, i); stack.push({ ind, close, kind, src: i }); declared.push(new Set()); };
      const say = (t) => push(pad + t, i);
      let m;
      if ((m = raw.trim().match(/^(?:js|javascript|raw)\s*:\s?(.*)$/i))) { note(inf, 'Raw JavaScript: copied exactly as written.'); return say(m[1]); }
      let s = raw.trim().replace(/[.:]$/, '');
      const lead = s.match(FILLER);
      if (lead && lead[0].length < s.length) { note(inf, `Left out filler: "${lead[0].trim()}".`); s = s.slice(lead[0].length); }
      if ((m = s.match(/^(?:note|comment)\s*:\s*(.*)$/i))) return say('// ' + m[1]);
      // --- events
      if ((m = s.match(/^when\s+(?:the\s+)?page (?:has )?(?:loaded|opens|starts)$/i))) {
        note(inf, 'Runs the indented lines once the page has finished loading.');
        return open(`document.addEventListener("DOMContentLoaded", ${needsAsync(i) ? 'async ' : ''}() => {`, '});', 'fn');
      }
      if ((m = s.match(/^when\s+(.+?)\s+is\s+(clicked|pressed|changed|typed in|hovered|pointed at|sent|submitted)$/i))) {
        const ev = { clicked: 'click', pressed: 'click', changed: 'change', 'typed in': 'input', hovered: 'mouseenter', 'pointed at': 'mouseenter', sent: 'submit', submitted: 'submit' }[m[2].toLowerCase()];
        const el = elementRef(m[1], x, inf);
        const isForm = ev === 'submit';
        note(inf, `${code('addEventListener("' + ev + '", …)')} runs the indented lines every time ${code(el.id)} ${ev === 'click' ? 'is clicked' : ev === 'submit' ? 'is sent' : 'changes'}.` + (isForm ? ' `preventDefault()` stops the browser from reloading the page when the form is sent.' : ''));
        open(`${el.js}.addEventListener("${ev}", ${needsAsync(i) ? 'async ' : ''}${isForm || usesEvent(i) ? '(event)' : '()'} => {`, '});', 'fn');
        if (isForm) push('  '.repeat(stack.length) + 'event.preventDefault();', i);
        return;
      }
      if ((m = s.match(/^every\s+(\S+)\s+seconds?$/i))) { note(inf, '`setInterval` runs the indented lines again and again. The time is in milliseconds (1000 = 1 second).'); return open(`setInterval(${needsAsync(i) ? 'async ' : ''}() => {`, `}, ${Math.round(parseFloat(m[1]) * 1000)});`, 'fn'); }
      if ((m = s.match(/^after\s+(\S+)\s+seconds?$/i))) { note(inf, '`setTimeout` runs the indented lines once, after a delay in milliseconds.'); return open(`setTimeout(${needsAsync(i) ? 'async ' : ''}() => {`, `}, ${Math.round(parseFloat(m[1]) * 1000)});`, 'fn'); }
      // --- the page
      if ((m = s.match(/^get the (?:text|value) (?:of|in|from)\s+(.+?)\s+and store (?:it )?in\s+([A-Za-z_$][\w$]*)$/i))) {
        const el = elementRef(m[1], x, inf);
        const prop = /^(input|textarea|select)$/.test(el.tag) ? 'value' : 'textContent';
        note(inf, prop === 'value' ? 'Text boxes keep what was typed in `.value`.' : '`.textContent` is the text shown inside the element.');
        const kw = declared.has(m[2]) ? '' : 'let '; declared.add(m[2]);
        return say(`${kw}${m[2]} = ${el.js}.${prop};`);
      }
      if ((m = s.match(/^set the (?:text|value) of\s+(.+?)\s+to\s+(.+)$/i))) {
        const el = elementRef(m[1], x, inf);
        const prop = /^(input|textarea|select)$/.test(el.tag) ? 'value' : 'textContent';
        note(inf, '`textContent` sets plain text safely: anything typed by users is shown as text, never run as code.');
        return say(`${el.js}.${prop} = ${E(m[2], inf)};`);
      }
      if ((m = s.match(/^(?:clear|empty)\s+(.+)$/i))) {
        const el = elementRef(m[1], x, inf);
        return say(/^(input|textarea|select)$/.test(el.tag) ? `${el.js}.value = "";` : `${el.js}.replaceChildren();`);
      }
      if ((m = s.match(/^hide\s+(.+)$/i))) { const el = elementRef(m[1], x, inf); return say(`${el.js}.hidden = true;`); }
      if ((m = s.match(/^(?:reveal|unhide|show the element)\s+(.+)$/i))) { const el = elementRef(m[1], x, inf); return say(`${el.js}.hidden = false;`); }
      if ((m = s.match(/^put\s+(.+?)\s+in(?:to)? group\s+(.+)$/i))) { const el = elementRef(m[1], x, inf); note(inf, 'Adds a class, so the group\'s styles from Styling apply.'); return say(`${el.js}.classList.add("${toId(m[2])}");`); }
      if ((m = s.match(/^take\s+(.+?)\s+out of group\s+(.+)$/i))) { const el = elementRef(m[1], x, inf); return say(`${el.js}.classList.remove("${toId(m[2])}");`); }
      if ((m = s.match(/^(?:switch|toggle) group\s+(.+?)\s+on\s+(.+)$/i))) { const el = elementRef(m[2], x, inf); return say(`${el.js}.classList.toggle("${toId(m[1])}");`); }
      if ((m = s.match(/^add\s+(.+?)\s+to the (?:page )?list\s+(.+)$/i)) || ((m = s.match(/^add\s+(.+?)\s+to\s+([\w-]+)$/i)) && x.shared.ids[toId(m[2])] && /^(ul|ol)$/.test(x.shared.ids[toId(m[2])].tag))) {
        const el = elementRef(m[2], x, inf);
        note(inf, 'Makes a new list item (`<li>`), sets its text safely with `textContent`, and adds it to the end of the list on the page.');
        say('{');
        push(pad + '  const newListItem = document.createElement("li");', i);
        push(pad + `  newListItem.textContent = ${E(m[1], inf)};`, i);
        push(pad + `  ${el.js}.append(newListItem);`, i);
        return say('}');
      }
      if ((m = s.match(/^scroll to\s+(.+)$/i))) { const el = elementRef(m[1], x, inf); note(inf, '`scrollIntoView` scrolls the page until the element is visible, smoothly.'); return say(`${el.js}.scrollIntoView({ behavior: "smooth" });`); }
      if ((m = s.match(/^show (?:a )?message\s+(.+)$/i))) { note(inf, '`alert` shows a pop-up. For anything more than a quick test, "set the text of …" on the page is friendlier.'); return say(`alert(${E(m[1], inf)});`); }
      if ((m = s.match(/^(?:go to|open the page)\s+(.+)$/i))) return say(`window.location.href = ${E(m[1], inf)};`);
      // --- the server and the browser's memory
      if ((m = s.match(/^(?:fetch|get|load)\s+(?:data\s+)?from\s+(.+?)\s+and store (?:it )?in\s+([A-Za-z_$][\w$]*)$/i))) {
        const kw = declared.has(m[2]) ? '' : 'const '; declared.add(m[2]);
        note(inf, '`fetch` asks the server for data and `await` waits for the reply without freezing the page. `.json()` turns the reply into values JavaScript can use.');
        return say(`${kw}${m[2]} = await (await fetch(${E(m[1], inf)})).json();`);
      }
      if ((m = s.match(/^send\s+(.+?)\s+to\s+(.+?)(?:\s+and store the reply in\s+([A-Za-z_$][\w$]*))?$/i))) {
        note(inf, 'Sends the data to the server as JSON with a POST request.');
        const call = `await fetch(${E(m[2], inf)}, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(${E(m[1], inf)}) })`;
        if (m[3]) { const kw = declared.has(m[3]) ? '' : 'const '; declared.add(m[3]); return say(`${kw}${m[3]} = await (${call}).json();`); }
        return say(call + ';');
      }
      if ((m = s.match(/^save\s+(.+?)\s+in the browser as\s+(.+)$/i))) { note(inf, '`localStorage` keeps data in this browser, even after the page is closed. It is stored as text, so `JSON.stringify` turns values into text.'); return say(`localStorage.setItem(${E(m[2], inf)}, JSON.stringify(${E(m[1], inf)}));`); }
      if ((m = s.match(/^load\s+(.+?)\s+from the browser and store (?:it )?in\s+([A-Za-z_$][\w$]*)$/i))) { const kw = declared.has(m[2]) ? '' : 'let '; declared.add(m[2]); return say(`${kw}${m[2]} = JSON.parse(localStorage.getItem(${E(m[1], inf)}));`); }
      // --- logic (same sentences as Python, JavaScript output)
      if ((m = s.match(/^(?:otherwise if|else if)\s+(.+)$/i))) { push('  '.repeat(stack.length - 1) + `} else if (${E(m[1], inf, true)}) {`, i); return; }
      if (/^(?:otherwise|else)$/i.test(s)) { push('  '.repeat(stack.length - 1) + '} else {', i); return; }
      if ((m = s.match(/^if\s+(.+)$/i))) return open(`if (${E(m[1], inf, true)}) {`, '}', 'if');
      if ((m = s.match(/^repeat\s+(.+?)\s+times?(?:\s+counting with\s+(\w+))?$/i))) { const v = m[2] || 'i'; x.vars.add(v); return open(`for (let ${v} = 0; ${v} < ${E(m[1], inf)}; ${v}++) {`, '}', 'loop'); }
      if ((m = s.match(/^for each\s+([A-Za-z_$][\w$]*)\s+in\s+(.+)$/i))) { note(inf, '`for … of` goes through the items one at a time.'); return open(`for (const ${m[1]} of ${E(m[2], inf)}) {`, '}', 'loop'); }
      if ((m = s.match(/^(?:while|as long as)\s+(.+)$/i))) return open(`while (${E(m[1], inf, true)}) {`, '}', 'loop');
      if ((m = s.match(/^define\s+([A-Za-z_$][\w$]*)(?:\s+using\s+(.+))?$/i))) { note(inf, '`function` makes a reusable tool.'); return open(`${needsAsync(i) ? 'async ' : ''}function ${m[1]}(${m[2] ? splitItems(m[2]).join(', ') : ''}) {`, '}', 'fn'); }
      if ((m = s.match(/^(?:give back|return)\b\s*(.*)$/i))) return say(m[1] ? `return ${E(m[1], inf)};` : 'return;');
      if (/^stop the loop$/i.test(s)) return say('break;');
      if (/^skip to next$/i.test(s)) return say('continue;');
      if ((m = s.match(/^(?:create|make)\s+(?:an?\s+)?(?:empty\s+)?list\s+(?:called\s+)?([A-Za-z_$][\w$]*)(?:\s+with\s+(.+))?$/i))) {
        const kw = declared.has(m[1]) ? '' : 'let '; declared.add(m[1]);
        return say(`${kw}${m[1]} = [${m[2] ? splitItems(m[2]).map(v => E(v, inf)).join(', ') : ''}];`);
      }
      if ((m = s.match(/^add\s+(.+?)\s+to\s+([A-Za-z_$][\w$]*)$/i))) { note(inf, '`.push` adds to the end of a list.'); return say(`${m[2]}.push(${E(m[1], inf)});`); }
      if ((m = s.match(/^(?:increase)\s+(.+?)(?:\s+by\s+(.+))?$/i))) return say(`${E(m[1], inf)} += ${m[2] ? E(m[2], inf) : 1};`);
      if ((m = s.match(/^(?:decrease)\s+(.+?)(?:\s+by\s+(.+))?$/i))) return say(`${E(m[1], inf)} -= ${m[2] ? E(m[2], inf) : 1};`);
      if ((m = s.match(/^ask\s+(.+?)\s+and store (?:it )?in\s+([A-Za-z_$][\w$]*)$/i))) { const kw = declared.has(m[2]) ? '' : 'let '; declared.add(m[2]); note(inf, '`prompt` shows a pop-up question. It gives back text.'); return say(`${kw}${m[2]} = prompt(${E(m[1], inf)});`); }
      if ((m = s.match(/^constant\s+([A-Za-z_$][\w$]*)\s+(?:is|=)\s+(.+)$/i))) {
        declared.add(m[1]);
        note(inf, '`const` makes a name that always keeps this value; JavaScript stops with an error if anything tries to change it.');
        return say(`const ${m[1]} = ${E(m[2], inf)};`);
      }
      if ((m = s.match(/^(?:set|let|make)\s+([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+)\s+(?:to|be)\s+(.+)$/i))) {
        note(inf, `Changes ${code(m[1])}: a value that belongs to ${code(m[1].split('.').slice(0, -1).join('.'))}.`);
        return say(`${m[1]} = ${E(m[2], inf)};`);
      }
      if ((m = s.match(/^(?:set|let|make)\s+([A-Za-z_$][\w$]*)\s+(?:to|be)\s+(.+)$/i))) {
        const kw = declared.has(m[1]) ? '' : 'let ';
        if (kw) note(inf, '`let` creates a name that can change later.');
        declared.add(m[1]);
        return say(`${kw}${m[1]} = ${E(m[2], inf)};`);
      }
      if ((m = s.match(/^run\s+([A-Za-z_$][\w$.]*)(?:\s+with\s+(.+?))?(?:\s+and store (?:it |the result )?in\s+([A-Za-z_$][\w$]*))?$/i))) {
        const call = `${x.fns.has(m[1]) && needsAsyncFn(m[1]) ? 'await ' : ''}${m[1]}(${m[2] ? splitItems(m[2]).map(v => E(v, inf)).join(', ') : ''})`;
        if (m[3]) { const kw = declared.has(m[3]) ? '' : 'let '; declared.add(m[3]); return say(`${kw}${m[3]} = ${call};`); }
        return say(call + ';');
      }
      if ((m = s.match(/^show\s+(.+)$/i))) { note(inf, '`console.log` writes to the developer console (the terminal below). To show something on the page, use "set the text of …".'); return say(`console.log(${splitItems(outsideQuotes(m[1], (t) => t.replace(/\s+and\s+(?=["'\w])/gi, ', '))).map(v => E(v, inf)).join(', ')});`); }
      inf.errs.push('I don\'t recognise this sentence. Open the Index to see what Mechanics understands, or start the line with js: to write JavaScript directly.');
      say('// ??? ' + s);
    });
    function needsAsyncFn(name) {
      const idx = lines.findIndex(l => new RegExp(`^\\s*define\\s+${name}\\b`, 'i').test(l));
      return idx >= 0 && needsAsync(idx);
    }
    while (stack.length) { const b = stack.pop(); while (out.length && out[out.length - 1].text === '') out.pop(); push('  '.repeat(stack.length) + b.close, b.src); }
    out.forEach((o, idx) => { if (o.src >= 0) info[o.src].py.push(idx); });
    return { lines: out, info, text: out.map(o => o.text).join('\n').replace(/\n{3,}/g, '\n\n') + '\n' };
  }

  /* ================================================================== */
  /* A website project                                                   */
  /* ================================================================== */

  function compileWebsite(project) {
    const shared = { ids: {}, groups: {}, cssGroups: {}, addGroups: {} };
    const sec = (f) => project.sections.find(s => s.file === f) || { id: f, file: f, text: '' };
    // Structure first (names), then Styling (may add groups to Structure), then Structure again, then Mechanics
    compileHtml(sec('structure'), shared);
    const css = compileCss(sec('styling'), shared);
    shared.ids = {};
    const html = compileHtml(sec('structure'), shared);
    const js = compileJs(sec('mechanics'), shared);
    // the same page with each element marked with its sentence line, for the preview's Pick
    const marked = compileHtml(sec('structure'), { ...shared, ids: {}, mark: true });
    html.previewText = marked.text;
    const results = { structure: html, styling: css, mechanics: js };
    const syms = new Map();
    for (const [id, v] of Object.entries(shared.ids)) syms.set(id, { py: id, display: id, kind: 'element', tag: v.tag });
    for (const g of Object.keys({ ...shared.groups, ...shared.cssGroups })) syms.set('group ' + g, { py: g, display: 'group ' + g, kind: 'group' });
    return { results: Object.fromEntries(project.sections.map(s => [s.id, results[s.file]])), syms, shared };
  }

  /* The page with its CSS and JS inlined, for the live preview. */
  /* Returns { html, jsLine }: jsLine is the document line where script.js starts (to map errors back). */
  function previewDocument(compiled, helperScript) {
    const r = compiled.results;
    const st = r.structure || { text: '' };
    const html = st.previewText || st.text, css = (r.styling || { text: '' }).text, js = (r.mechanics || { text: '' }).text;
    const withCss = html.replace('<link rel="stylesheet" href="style.css">', `<style>\n${css}</style>`);
    const helper = helperScript ? `<script>${helperScript}</script>\n` : '';
    const doc = withCss.replace('<script src="script.js"></script>', `${helper}<script>\n${js.replace(/<\/script/gi, '<\\/script')}</script>`);
    const before = doc.slice(0, doc.indexOf('<script>\n' + js.slice(0, 20)));
    return { html: doc, jsLine: before.split('\n').length + 1 };
  }

  /* ------------------------------------------------------------------ */
  /* Phrase picker + Index content                                       */
  /* ------------------------------------------------------------------ */

  const T = (group, pattern, code2, tip, sections) => ({ group, pattern, py: code2, tip, sections });
  const TEMPLATES = [
    T('Page', 'page title is "‹title›"', '<title>…</title>', 'Shown in the browser tab.', ['structure']),
    T('Text', 'add a big heading "‹text›"', '<h1>…</h1>', 'One per page: the main title.', ['structure']),
    T('Text', 'add a heading "‹text›"', '<h2>…</h2>', '', ['structure']),
    T('Text', 'add a paragraph "‹text›"', '<p>…</p>', '', ['structure']),
    T('Controls', 'add a button called ‹name› saying "‹text›"', '<button id="name">…</button>', 'The name is how Styling and Mechanics refer to it.', ['structure']),
    T('Controls', 'add a text box called ‹name› with hint "‹hint›"', '<input id="name" placeholder="…">', 'Also: number box, password box, email box, big text box.', ['structure']),
    T('Controls', 'add a drop-down called ‹name› with "‹a›", "‹b›"', '<select><option>…', '', ['structure']),
    T('Controls', 'add a checkbox called ‹name› saying "‹text›"', '<input type="checkbox">', '', ['structure']),
    T('Media', 'add a picture of "‹file.jpg›" described as "‹what it shows›"', '<img src="…" alt="…">', 'The description is read aloud by screen readers.', ['structure']),
    T('Media', 'add a link to "‹https://…›" saying "‹text›"', '<a href="…">…</a>', '', ['structure']),
    T('Layout', 'add a section called ‹name›', '<section id="name">', 'Indent the things that belong inside it. Also: header, footer, navigation bar, main area, block, card, form, side panel.', ['structure']),
    T('Layout', 'add a list called ‹name›', '<ul id="name">', 'Indent "add a list item "…"" under it.', ['structure']),
    T('Layout', '… in group ‹name›', 'class="name"', 'Add to the end of any line to put it in a group (a CSS class).', ['structure']),
    T('Styles', 'style ‹name›: background ‹colour›, text colour ‹colour›', '#name { background: …; color: … }', 'Separate styles with commas.', ['styling']),
    T('Styles', 'create group ‹name›: rounded corners ‹8›, shadow', '.name { border-radius: 8px; box-shadow: … }', 'A group is a CSS class. Reuse it on many elements.', ['styling']),
    T('Styles', '‹element› belongs to group ‹group›', 'class="group" in the HTML', 'Adds the group to an element in Structure.', ['styling']),
    T('Styles', 'when ‹name› is hovered: ‹styles›', '#name:hover { … }', '', ['styling']),
    T('Styles', 'on screens narrower than ‹600›:', '@media (max-width: 600px) {', 'Indent styles under it for phones.', ['styling']),
    T('Styles', 'shared colour ‹main› is ‹#4f7cff›', ':root { --main: … }', 'Then use "background the colour main".', ['styling']),
    T('Events', 'when ‹name› is clicked', 'name.addEventListener("click", …)', 'Indent what should happen.', ['mechanics']),
    T('Events', 'when ‹form› is sent', 'form.addEventListener("submit", …)', 'The page won\'t reload.', ['mechanics']),
    T('Events', 'when the page has loaded', 'DOMContentLoaded', '', ['mechanics']),
    T('Events', 'every ‹2› seconds', 'setInterval(…, 2000)', '', ['mechanics']),
    T('Page', 'get the text of ‹name› and store in ‹value›', 'let value = name.value', 'Reads what was typed in a box.', ['mechanics']),
    T('Page', 'set the text of ‹name› to ‹value›', 'name.textContent = value', '', ['mechanics']),
    T('Page', 'add ‹value› to the list ‹name›', 'createElement("li") …', 'Adds a new item to a list on the page.', ['mechanics']),
    T('Page', 'hide ‹name›', 'name.hidden = true', 'And "reveal ‹name›".', ['mechanics']),
    T('Page', 'put ‹name› in group ‹group›', 'classList.add("group")', 'Also "take … out of group", "switch group … on …".', ['mechanics']),
    T('Server', 'fetch from "‹/api/items›" and store in ‹items›', 'await fetch(…).json()', '', ['mechanics']),
    T('Server', 'send ‹value› to "‹/api/items›"', 'fetch(…, { method: "POST" … })', '', ['mechanics']),
    T('Server', 'save ‹value› in the browser as "‹key›"', 'localStorage.setItem', 'And "load "key" from the browser and store in …".', ['mechanics']),
    T('Logic', 'set ‹name› to ‹value›', 'let name = value', 'Same sentences as Python: if, otherwise, repeat, for each, define, give back, run…', ['mechanics']),
    T('Logic', 'if ‹condition›', 'if (condition) {', '', ['mechanics']),
    T('Logic', 'for each ‹item› in ‹list›', 'for (const item of list) {', '', ['mechanics']),
    T('Logic', 'define ‹name› using ‹inputs›', 'function name(inputs) {', '', ['mechanics']),
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
    structure: [['called save', 'id="save"'], ['in group card', 'class="card"'], ['big heading', '<h1>'], ['heading', '<h2>'], ['block', '<div>'], ['navigation bar', '<nav>'], ['main area', '<main>'], ['side panel', '<aside>'], ['picture', '<img>'], ['text box', '<input>'], ['big text box', '<textarea>']],
    styling: [['background navy', 'background: navy'], ['background #000 40% see-through', 'background: rgba(0,0,0,0.6)'], ['50% see-through', 'opacity: 0.5'], ['text colour white', 'color: white'], ['text size 20', 'font-size: 20px'], ['space inside 12', 'padding: 12px'], ['space around 8', 'margin: 8px'], ['rounded corners 8', 'border-radius: 8px'], ['shadow', 'box-shadow: …'], ['in a row', 'display: flex'], ['in a grid of 3 columns', 'display: grid'], ['hand cursor', 'cursor: pointer'], ['centred', 'margin: 0 auto'], ['hidden', 'display: none']],
    mechanics: [['a is b', 'a === b'], ['a is not b', 'a !== b'], ['a and b', 'a && b'], ['not a', '!a'], ['length of x', 'x.length'], ['item 0 of x', 'x[0]'], ['random number from 1 to 6', 'Math.floor(Math.random()*6)+1'], ['text of name', 'name.value / .textContent'], ['"Hi {name}"', '`Hi ${name}`']],
  };
  const OPENS_BLOCK = /^\s*(?:when |every |after |if |otherwise|else|repeat |for each |while |define |add (?:a |an )?(?:section|header|footer|navigation|nav|main|block|box|area|form|side panel|sidebar|article|card|list|numbered list|table|row|pop-up|dialog)\b|on screens |in dark mode)/i;

  const api = { compileWebsite, compileHtml, compileCss, compileJs, previewDocument, TEMPLATES, GUIDES, WORDS, OPENS_BLOCK, toId, TAG_WORDS,
    cssPropsFor: (text, inf) => cssProps(text, inf), colorFor: (v, inf) => color(v, inf) };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.IntuiWeb = api;
})(typeof window !== 'undefined' ? window : globalThis);

/* IntuaCode — Predictive Mode: the rest of the sentence being typed, the way a terminal predicts a command.
 *
 * Predictions come from sentences written before (the project's own files, and lines entered with Enter,
 * most recent first), then from the sentence patterns the writers know. The best one shows after the
 * cursor in dim text; the app's list shows the others.
 *
 *   history(typed, lines, limit)  -> [sentence]: sentences that start with what's typed, each once, in order
 *   rest(typed, label)            -> what's still to type of label, or '' if label doesn't carry on from typed
 *   after(typed, pattern)         -> the rest of a pattern once its blanks so far are filled in, or ''
 *   nextWord(rest)                -> the next word of a prediction (with the spaces before it)
 *   remember(list, line, max)     -> list with line at the front (once), at most max long
 *   worth(line)                   -> is this line worth predicting again (a whole sentence, not a note or code)
 *   next(ctx)                     -> [step]: what usually comes after a line just written, as the Help asks it
 *   follows(ctx)                  -> [line]: the lines next() would add after it, for Predictive Mode to guess first
 *   frame(url, opts)              -> [step]: why an embedded page may stay blank, and the address that would show
 *
 * A step: { kind: 'tip' (something that likely won't work as written) | 'next' (what people usually do next),
 *   ask, label (its button, '' for advice only), how: 'replace' (the line becomes text) | 'after' (text goes
 *   under it) | 'file' (text goes at the end of the page's role file), text, role }.
 *
 * No page here (no DOM): the app and the tests both use it.
 */
(function (root) {
  'use strict';

  const clean = (s) => String(s).replace(/\s+$/, '').trim();

  /* A line worth offering again: a sentence with something in it, not a note, a comment, an exact line of
     code (python:, js:, c++: …) or a line with blanks (‹…›) still to fill. */
  function worth(line) {
    const s = clean(line);
    if (s.length < 3 || /[‹›]/.test(s)) return false;
    if (/^(?:note|comment|description|teach)\s*:/i.test(s)) return false;
    if (/^(?:python|html|css|js|ts|tsx|c\+\+)\s*:/i.test(s)) return false;
    return true;
  }

  function history(typed, lines, limit = 3) {
    const t = clean(typed).toLowerCase();
    if (!t) return [];
    const out = [], seen = new Set();
    for (const raw of lines) {
      const s = clean(raw), low = s.toLowerCase();
      if (!worth(s) || low === t || !low.startsWith(t) || seen.has(low)) continue;
      seen.add(low);
      out.push(s);
      if (out.length >= limit) break;
    }
    return out;
  }

  /* The part of label after what's typed. Upper and lower case don't matter (accepting writes label's own),
     and spaces typed at the end count, so "set " carries on as "speed to 5", not " speed to 5". */
  function rest(typed, label) {
    typed = String(typed); label = String(label);
    if (!typed || label.length <= typed.length) return '';
    return label.slice(0, typed.length).toLowerCase() === typed.toLowerCase() ? label.slice(typed.length) : '';
  }

  /* The next word of a prediction, with the spaces before it: "speed to 5" -> "speed", " to 5" -> " to". */
  function nextWord(r) {
    const m = String(r).match(/^\s*(?:‹[^›]*›|[^\s‹]+)/);
    return m ? m[0] : String(r);
  }

  /* The rest of a sentence pattern once its blanks so far are filled in: with "add a paragraph called ‹name›
     saying "‹text›"", what's typed as "add a paragraph called intro" carries on as ' saying "‹text›"'.
     '' if what's typed doesn't fit the pattern, or only a closing quote is left. */
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+');
  function after(typed, pattern) {
    typed = String(typed); pattern = String(pattern);
    const parts = pattern.split(/(‹[^›]*›)/);   // words, blank, words, blank, …
    let re = '';
    for (let k = 1; k < parts.length; k += 2) {
      const q = parts[k - 1].slice(-1);
      // a blank in quotes takes anything up to the quote; one outside them, a word or something in quotes
      re += esc(parts[k - 1]) + (q === '"' ? '[^"]*' : q === "'" ? "[^']*" : '(?:"[^"]*"|\'[^\']*\'|[^\\s"\']+)');
      const m = typed.match(new RegExp('^' + re + '([\\s\\S]*)$', 'i'));
      if (!m) return '';
      const tail = m[1], rest = parts.slice(k + 1).join('');
      if (tail.length < rest.length && rest.slice(0, tail.length).toLowerCase() === tail.toLowerCase()) {
        const out = rest.slice(tail.length);
        return /[a-z‹]/i.test(out) ? out : '';
      }
    }
    return '';
  }

  function remember(list, line, max = 300) {
    const s = clean(line);
    if (!worth(s)) return list.slice(0, max);
    const low = s.toLowerCase();
    return [s, ...list.filter(x => x.toLowerCase() !== low)].slice(0, max);
  }

  /* ---------- What comes next ----------
   * The usual company a line keeps: a link to another site may be wanted shown inside the page, a text box
   * usually has a button to send it, a list its items, a drawing area something drawn on it every frame, a
   * question asked a look at the answer. Worked out from what the line makes (its code: one element, one
   * statement), so it holds however the sentence is said. */

  // sites that tell browsers not to show them inside another page (X-Frame-Options, frame-ancestors), outside
  // the addresses they make for that (an embed address, a published document)
  const REFUSES = /(?:^|\.)(?:google\.[a-z.]+|facebook\.com|instagram\.com|x\.com|twitter\.com|linkedin\.com|github\.com|reddit\.com|amazon\.[a-z.]+|netflix\.com|tiktok\.com|stackoverflow\.com|chatgpt\.com|bing\.com|paypal\.com|youtube\.com)$/i;
  const EMBEDS = /\/embed\b|[?&]output=embed\b|\/preview\b|\/pub\b|[?&]embed=true\b/i;
  function hostOf(url) { const m = String(url).match(/^https?:\/\/([^/?#:]+)/i); return m ? m[1].toLowerCase() : ''; }
  const bare = (host) => host.replace(/^(?:www|m)\./, '');

  /* The address a site makes for showing a page inside another one, for a page that has one. */
  function embedFor(url) {
    const host = bare(hostOf(url)), u = String(url);
    let m;
    if (host === 'youtu.be' && (m = u.match(/^https?:\/\/[^/]+\/([\w-]{6,})/i))) return `https://www.youtube.com/embed/${m[1]}`;
    if (host === 'youtube.com' && (m = u.match(/[?&]v=([\w-]{6,})/) || u.match(/\/(?:shorts|live)\/([\w-]{6,})/))) return `https://www.youtube.com/embed/${m[1]}`;
    if (host === 'vimeo.com' && (m = u.match(/vimeo\.com\/(\d+)/))) return `https://player.vimeo.com/video/${m[1]}`;
    if (host === 'open.spotify.com' && !/\/embed\//.test(u) && (m = u.match(/open\.spotify\.com\/(track|album|playlist|episode|show|artist)\/(\w+)/))) return `https://open.spotify.com/embed/${m[1]}/${m[2]}`;
    return null;
  }

  function frame(url, opts = {}) {
    const u = String(url || '').trim(), out = [];
    if (!u || /^(?:#|data:|about:|javascript:)/i.test(u)) return out;
    const host = hostOf(u), name = bare(host);
    if (!host) return out;   // a page of the project's (the writer gives "www.example.com" its https://)
    if (/^http:/i.test(u) && opts.secure) out.push({ kind: 'tip', ask: 'This page is shown over https://, and browsers don\'t show an http:// page inside it.', label: 'Use https://', how: 'url', text: u.replace(/^http:/i, 'https:') });
    const embed = embedFor(u);
    if (embed) {
      const what = /youtu/.test(name) ? 'YouTube' : /vimeo/.test(name) ? 'Vimeo' : 'Spotify';
      out.push({ kind: 'tip', ask: `${what} doesn't let other pages show this address, so the box stays blank or says it refused to connect. Its embed address shows the same thing.`, label: 'Use the embed address', how: 'url', text: embed });
    } else if (/^google\./.test(name) && /\/maps\b/.test(u) && !EMBEDS.test(u)) {
      out.push({ kind: 'tip', ask: 'Google Maps shows inside a page only from its embed address: in Google Maps, choose Share, then Embed a map, and copy the address inside src="…".', label: '', how: 'url', text: '' });
    } else if (REFUSES.test(host) && !EMBEDS.test(u)) {
      out.push({ kind: 'tip', ask: `${name} doesn't let other pages show it, so the box stays blank or says it refused to connect. A link to it opens it instead.`, label: 'Make it a link', how: 'link', text: u });
    } else {
      out.push({ kind: 'next', ask: 'If the box stays blank or says it refused to connect, that site doesn\'t let other pages show it (many big sites don\'t). A link to it opens it instead.', label: 'Make it a link', how: 'link', text: u });
    }
    return out;
  }

  /* An element's tag and attributes, from the first tag in a line of HTML. */
  function tagOf(code) {
    const m = String(code || '').match(/<([a-z][\w-]*)\b([^>]*)>/i);
    if (!m) return null;
    const attrs = {};
    for (const a of m[2].matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g)) attrs[a[1].toLowerCase()] = a[2] ?? a[3] ?? a[4] ?? '';
    const text = (String(code).match(/>([^<]*)</) || [])[1] || '';
    return { tag: m[1].toLowerCase(), attrs, text: text.replace(/&quot;/g, '"').replace(/&amp;/g, '&').trim() };
  }
  const say = (id) => (/^[a-z][\w-]*$/i.test(id) ? id : `"${id}"`);
  const q = (s) => `"${String(s).replace(/"/g, "'")}"`;
  const unused = (base, ids) => { let n = base; for (let k = 2; ids.has(n); k++) n = base + k; return n; };

  /* ctx: { lang: 'html' | 'python', code: what the line makes, line: the line as written, indent: its spaces,
       last: no line comes after it, nextIndent: the next line's spaces ('' when there's none),
       ids: the page's element names (a Set), has: { button, form }, says(role, word): a file of the page says it,
       secure: the page is shown over https:// } */
  function next(ctx) {
    const out = [], line = String(ctx.line || '').trimEnd(), ind = ctx.indent || '', ids = ctx.ids || new Set();
    const set = (s) => line.replace(/\s+$/, '') + ', ' + s;   // a setting said after the sentence
    const deeper = (ctx.nextIndent || '').length > ind.length;
    if (ctx.lang === 'html') {
      const e = tagOf(ctx.code);
      if (!e) return out;
      const a = e.attrs;
      if (e.tag === 'a' && /^https?:\/\//i.test(a.href || '')) {
        const url = a.href, embed = embedFor(url), refuses = REFUSES.test(hostOf(url)) && !EMBEDS.test(url) && !embed;
        if (embed) out.push({ kind: 'next', ask: 'Show the video itself on the page, rather than a link to it?', label: 'Show it on the page', how: 'replace', text: `${ind}add an embedded page, from ${q(embed)}, sized 560 by 315, with tooltip ${q(e.text || 'Video')}` });
        else if (!refuses) out.push({ kind: 'next', ask: 'Show that page inside yours, rather than a link to it?', label: 'Embed it', how: 'replace', text: `${ind}add an embedded page, from ${q(url)}, sized 600 by 400, with tooltip ${q(e.text || bare(hostOf(url)))}` });
        if (a.target !== '_blank') out.push({ kind: 'next', ask: 'Open it in a new tab, so your page stays open?', label: 'Open in a new tab', how: 'replace', text: set('opening in a new tab') });
      } else if (e.tag === 'iframe') {
        // the address as the line says it (the code's may be written differently: spaces as %20, say)
        const said = (line.match(/"[^"]*"|'[^']*'/g) || []).map(s => s.slice(1, -1)).find(s => s && (s === a.src || encodeURI(s) === a.src || a.src.endsWith('//' + s))) || a.src;
        for (const s of frame(a.src, ctx)) {
          if (s.how === 'url') out.push({ ...s, how: 'replace', text: s.text && line.includes(said) ? line.replace(said, s.text) : '', label: s.text && line.includes(said) ? s.label : '' });
          else if (s.how === 'link') out.push({ ...s, how: 'replace', text: `${ind}add a link to ${q(s.text)} saying ${q(a.title || bare(hostOf(s.text)) || 'Open it')}` });
          else out.push(s);
        }
        if (!a.width && !a.height) out.push({ kind: 'next', ask: 'Make it bigger? An embedded page is 300 by 150 unless it\'s sized.', label: 'Size it 600 by 400', how: 'replace', text: set('sized 600 by 400') });
        if (!a.title) out.push({ kind: 'next', ask: 'Say what it shows, for people using screen readers?', label: 'Add a tooltip', how: 'replace', text: set('with tooltip "‹what it shows›"') });
      } else if (e.tag === 'img' && !a.alt && !/\bdescribed as\b|no description/i.test(line)) {
        out.push({ kind: 'next', ask: 'Describe the picture, for people who can\'t see it?', label: 'Add a description', how: 'replace', text: set('described as "‹what it shows›"') });
      } else if (/^(?:input|textarea|select)$/.test(e.tag) && !['hidden', 'submit', 'button'].includes(a.type) && !(ctx.has || {}).button && !(ctx.has || {}).form) {
        out.push({ kind: 'next', ask: 'Add a button to use what\'s put in here?', label: 'Add a button', how: 'after', text: `${ind}add a button called ${unused('go', ids)} saying "Go"` });
      } else if (/^h[1-3]$/.test(e.tag) && ctx.last) {
        out.push({ kind: 'next', ask: 'Add some words under the heading?', label: 'Add a paragraph', how: 'after', text: `${ind}add a paragraph "‹text›"` });
      } else if (/^(?:ul|ol)$/.test(e.tag) && !deeper) {
        out.push({ kind: 'next', ask: 'Add the list\'s first item?', label: 'Add an item', how: 'after', text: `${ind}    add a list item "‹text›"` });
      } else if (/^(?:section|header|footer|main|article|aside|nav)$/.test(e.tag) && !deeper) {
        out.push({ kind: 'next', ask: 'Give it a heading?', label: 'Add a heading', how: 'after', text: `${ind}    add a heading "‹text›"` });
      } else if (e.tag === 'canvas' && a.id && ctx.says && !ctx.says('mechanics', a.id)) {
        out.push({ kind: 'next', ask: `Draw something on ${a.id}? Mechanics draws on it every frame.`, label: 'Draw on it', how: 'file', role: 'mechanics', text: `every frame\n    fill ${say(a.id)} with "skyblue"\n    draw a circle at 100, 100 with radius 20 in "gold" on ${say(a.id)}` });
      }
      return out;
    }
    if (ctx.lang === 'python') {
      const code = String(ctx.code || '').trim().split('\n')[0].trim();   // a block's first line: while True:
      let m;
      if (deeper || !code) return out;
      const name = ((line.match(/\bstore (?:it )?in\s+(.+?)\s*$/i) || line.match(/^\s*(?:set|create list)\s+(.+?)\s+(?:to|with)\b/i) || [])[1] || '').trim();
      if (/^\w+\s*=\s*(?:int|float)\(input\(/.test(code) && name) out.push({ kind: 'next', ask: `Do something with the number in ${name}?`, label: 'Check it', how: 'after', text: `${ind}if ${name} is more than ‹10›\n${ind}    show "‹That's a lot!›"` });
      else if (/^\w+\s*=\s*input\(/.test(code) && name) out.push({ kind: 'next', ask: `Show the answer back?`, label: 'Show it', how: 'after', text: `${ind}show "You said {${name}}"` });
      else if (/^\w+\s*=\s*random\.(?:randint|choice|random|uniform)\(/.test(code) && name) out.push({ kind: 'next', ask: `Show what ${name} came out as?`, label: 'Show it', how: 'after', text: `${ind}show ${name}` });
      else if (/^\w+\s*=\s*\[.*\]$/.test(code) && name && (m = name)) out.push({ kind: 'next', ask: `Go through ${m}, one item at a time?`, label: 'Go through it', how: 'after', text: `${ind}for each item in ${m}\n${ind}    show item` });
      else if (/^while True:$/.test(code)) out.push({ kind: 'next', ask: 'Wait a moment each time round, so it doesn\'t run flat out?', label: 'Add a wait', how: 'after', text: `${ind}    wait 1 seconds` });
      return out;
    }
    return out;
  }
  /* The lines next() would add after a line, for Predictive Mode: what's usually written next is guessed first. */
  const follows = (ctx) => next(ctx).filter(s => s.how === 'after').map(s => s.text.split('\n')[0]);

  root.IntuiPredict = { history, rest, after, nextWord, remember, worth, next, follows, frame, embedFor };
})(typeof window !== 'undefined' ? window : globalThis);

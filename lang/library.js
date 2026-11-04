/* IntuCode — the Library: common parts to add to a project, and the kinds of project they go in.
 *
 * Two kinds of entry, in plain text, in the packs in lang/library/ (lang/library/README.md has a writing
 * guide). Each pack file adds its entries with
 *
 *   (window.IntuiLibraryPacks = window.IntuiLibraryPacks || []).push(`type: …`, `part: …`);
 *
 * A TYPE is a kind of project: what it is, the languages it is usually written in (and what each one does
 * there), the frameworks people use, open-source projects worth reading, and the parts it is made of.
 *
 *   type: daw                              its id: lower case, numbers and dashes
 *   title: Audio tools and DAWs
 *   heading: Audio, music and video        types with the same heading are listed together
 *   platforms: pc                          where it runs: pc, phone, web, board (several with commas)
 *   about: One line.
 *   language: C++ | what it does in this kind of project | JUCE, iPlug2, CLAP SDK
 *                                          one per language: its name or id (lang/languages.js), what it is
 *                                          for here, and the usual frameworks and libraries (optional)
 *   learn from: Ardour | C++ | GPL-2.0 | https://ardour.org | A full DAW: tracks, buses, plug-in hosting.
 *                                          an open-source project to read: name | main language | licence
 *                                          (SPDX id) | address | what to look at in it
 *   parts: gain-db, pan-law, biquad        the Library parts it is usually made of
 *   templates: daw                         optional: ids of Project Templates (builder kits) that fit
 *
 * A PART is one thing to add to a project: a feature, a tool, a shape, a detail. It is written in one or more
 * languages; a Coding integration part gives both sides of a link between two languages.
 *
 *   part: gain-db
 *   title: Gain in decibels
 *   group: audio                           one of GROUPS below
 *   types: daw, audio-plugin               optional: more types it belongs to (as well as their "parts:" lines)
 *   about: One line.
 *   summary: Plain words, one to three sentences: what it does and why.
 *   learn: What to learn first.
 *   source: Audio EQ Cookbook | https://www.w3.org/TR/audio-eq-cookbook/ | the coefficient formulas
 *                                          where an idea or formula came from (address optional); one per source
 *   == python dsp.py                       a variant: a language id from lang/languages.js and its file name
 *   define gain from decibels using db     …then its text, up to the next "==" line
 *       give back 10 to the power of (db divided by 20)
 *   == cpp gain.cpp
 *   …
 *
 * What a variant's text is depends on the language's "write" (lang/languages.js):
 *   sentences  IntuCode sentences in that language's writer: Python (lang/python.js); JavaScript, HTML and
 *              CSS as a website's Mechanics, Structure and Styling (lang/web_write.js); C++ and Arduino
 *              (lang/cpp_write.js). Lines like "python:", "js:" or "c++:" hold exact code where no sentence fits.
 *   code       the exact code
 *   text       data or notes, as they are
 *
 * IntuiLibrary.catalog() reads every pack: { types, parts, groups, headings, errors }. Errors are listed, not
 * thrown, so one broken entry doesn't hide the rest. No DOM here: the shell draws it.
 */
(function (root) {
  'use strict';

  /* The groups parts are filed under, in the order they are listed. */
  const GROUPS = [
    { id: 'audio', title: 'Audio and DSP', about: 'Gain, panning, meters, filters, dynamics, delay and the rules for real-time audio code.' },
    { id: 'music', title: 'Music and MIDI', about: 'Notes and frequencies, tempo, envelopes, oscillators and MIDI messages.' },
    { id: 'interface', title: 'Interface', about: 'Things on screen people use: themes, dialogs, tabs, forms, sliders, shortcuts.' },
    { id: 'graphics', title: 'Shapes and colour', about: 'Colour codes, points and polygons, rotation, gradients and shadows.' },
    { id: 'games', title: 'Games', about: 'Game loops, collisions, gravity, sprites, tile maps, cameras and saved scores.' },
    { id: 'maths', title: 'Maths and numbers', about: 'Clamping, mapping one range onto another, vectors, smoothing and statistics.' },
    { id: 'data', title: 'Data', about: 'CSV and JSON, grouping and counting, dates and times, searching and charts.' },
    { id: 'files', title: 'Files and system', about: 'Files and folders, command-line arguments, settings, logs and timing.' },
    { id: 'storage', title: 'Storage and databases', about: 'SQLite tables, the browser\'s storage, caches and undo.' },
    { id: 'networking', title: 'Networking', about: 'Fetching with time-outs and retries, web routes, UDP, MQTT and rate limits.' },
    { id: 'security', title: 'Security', about: 'Passwords, tokens, signed messages and showing what people type safely.' },
    { id: 'hardware', title: 'Hardware', about: 'Buttons, timing without delay, PWM, servos, distance and temperature sensors.' },
    { id: 'integration', title: 'Coding integration', about: 'Ready-made code that lets two languages work together in one project: each part gives both sides.' },
  ];
  const PLATFORMS = { pc: 'PC', phone: 'Phone', web: 'Web', board: 'Board' };
  const REPEATED = new Set(['language', 'learn from', 'source']);
  const TYPE_KEYS = new Set(['type', 'title', 'heading', 'platforms', 'about', 'language', 'learn from', 'parts', 'templates']);
  const PART_KEYS = new Set(['part', 'title', 'group', 'types', 'about', 'summary', 'learn', 'source']);
  /* File endings a language may use beyond its own list in lang/languages.js (a C header is .h, which is C++'s). */
  const EXTRA_EXTS = { c: ['h'] };

  const list = (s) => String(s || '').split(',').map(x => x.trim()).filter(Boolean);
  const fields = (s, n) => { const p = String(s).split('|').map(x => x.trim()); return p.length > n ? [...p.slice(0, n - 1), p.slice(n - 1).join(' | ')] : p; };
  const isUrl = (s) => /^https?:\/\/\S+$/.test(s);
  const ID = /^[a-z0-9][a-z0-9-]*$/;

  /* One entry's text -> { kind, id, head, variants, problems }: its own problems only (what the whole catalog
   * says about it, like a part no type lists, comes from build()). */
  function parseEntry(text) {
    const lines = String(text).replace(/\r\n/g, '\n').split('\n');
    const head = {}, variants = [], problems = [];
    let cur = null;
    lines.forEach((line, n) => {
      const v = line.match(/^==\s+(\S+)(?:\s+(.+?))?\s*$/);
      if (v) { cur = { lang: v[1], file: v[2] || '', lines: [] }; variants.push(cur); return; }
      if (cur) { cur.lines.push(line); return; }
      if (!line.trim()) return;
      const m = line.match(/^([a-z][a-z ]*?)\s*:\s?(.*)$/i);
      if (!m) { problems.push(`Line ${n + 1} ("${line.trim().slice(0, 40)}") isn't "name: value". Text for a language goes after an "== language file" line.`); return; }
      const key = m[1].toLowerCase();
      if (REPEATED.has(key)) (head[key] = head[key] || []).push(m[2].trim());
      else if (head[key] != null) problems.push(`"${key}:" is given twice.`);
      else head[key] = m[2].trim();
    });
    for (const v of variants) {
      while (v.lines.length && !v.lines[v.lines.length - 1].trim()) v.lines.pop();
      while (v.lines.length && !v.lines[0].trim()) v.lines.shift();
      v.text = v.lines.join('\n');
      delete v.lines;
    }
    const kind = head.type != null ? 'type' : head.part != null ? 'part' : null;
    const id = kind ? head[kind] : '';
    if (!kind) problems.push('The first line says what this is: "type: …" or "part: …".');
    else if (head.type != null && head.part != null) problems.push('An entry is a type or a part, not both.');
    else if (!ID.test(id)) problems.push(`"${id}" can't be an id: use lower-case letters, numbers and dashes, like gain-db.`);
    const known = kind === 'type' ? TYPE_KEYS : PART_KEYS;
    if (kind) for (const k of Object.keys(head)) if (!known.has(k)) problems.push(`"${k}:" isn't something a ${kind} has. It has: ${[...known].join(', ')}.`);
    if (kind === 'type' && variants.length) problems.push('A type lists its parts ("parts: …"); code goes in the parts themselves.');
    return { kind, id, head, variants, problems };
  }

  /* A language named in a pack ("C++", "cpp", "JavaScript") -> its id in lang/languages.js, or null. */
  function langId(said, LANGS) {
    const s = String(said || '').trim().toLowerCase();
    if (!s || !LANGS) return null;
    if (LANGS.byId(s)) return s;
    const hit = LANGS.LANGUAGES.find(l => l.name.toLowerCase() === s);
    return hit ? hit.id : null;
  }

  /* Every entry -> the catalog. */
  function build(entries) {
    const LANGS = root.IntuiLanguages;
    const errors = [];
    if (!LANGS) errors.push('lang/languages.js isn\'t loaded, so no language can be checked. Load it before lang/library.js.');
    const types = [], parts = [], typeById = {}, partById = {};
    const say = (e, msg) => errors.push(`${e.kind || 'entry'} ${e.id || '?'}: ${msg}`);
    for (const text of entries) {
      const e = parseEntry(text);
      e.problems.forEach(p => say(e, p));
      if (!e.kind || !ID.test(e.id)) continue;
      const h = e.head;
      if (e.kind === 'type') {
        if (typeById[e.id]) { say(e, 'another type already has this id.'); continue; }
        const t = {
          id: e.id, title: h.title || e.id, heading: h.heading || '', about: h.about || '',
          platforms: list(h.platforms), partIds: list(h.parts), templates: list(h.templates),
          languages: (h.language || []).map((s) => { const [name, why, uses] = fields(s, 3); return { lang: langId(name, LANGS), said: name, why: why || '', uses: list(uses) }; }),
          learnFrom: (h['learn from'] || []).map((s) => { const [name, lang, licence, url, what] = fields(s, 5); return { name: name || '', lang: langId(lang, LANGS), said: lang || '', licence: licence || '', url: url || '', what: what || '' }; }),
        };
        if (!h.title) say(e, 'add "title:".');
        if (!h.heading) say(e, 'add "heading:", the group of types it is listed under.');
        if (!h.about) say(e, 'add "about:", one line on what it is.');
        if (!t.platforms.length) say(e, `add "platforms:", where it runs: ${Object.keys(PLATFORMS).join(', ')}.`);
        for (const p of t.platforms) if (!PLATFORMS[p]) say(e, `"${p}" isn't a platform. Use ${Object.keys(PLATFORMS).join(', ')}.`);
        if (!t.languages.length) say(e, 'add at least one "language: name | what it is for here | frameworks".');
        for (const l of t.languages) {
          if (!l.lang) say(e, `"${l.said}" isn't a language in lang/languages.js.`);
          if (!l.why) say(e, `"language: ${l.said}" needs what it is for here, after a |.`);
        }
        for (const l of t.learnFrom) {
          if (!l.name || !l.licence || !l.what) say(e, `"learn from: ${l.name}" needs name | language | licence | address | what to look at.`);
          if (!l.lang) say(e, `"learn from: ${l.name}": "${l.said}" isn't a language in lang/languages.js.`);
          if (!isUrl(l.url)) say(e, `"learn from: ${l.name}": "${l.url}" isn't a web address (http… or https…).`);
        }
        types.push(t); typeById[t.id] = t;
      } else {
        if (partById[e.id]) { say(e, 'another part already has this id.'); continue; }
        const p = {
          id: e.id, title: h.title || e.id, group: h.group || '', typeIds: list(h.types), about: h.about || '', summary: h.summary || '', learn: h.learn || '',
          sources: (h.source || []).map((s) => { const [name, url, what] = fields(s, 3); return { name: name || '', url: url || '', what: what || '' }; }),
          variants: e.variants.map((v) => {
            const L = LANGS && LANGS.byId(v.lang);
            const file = v.file || (L ? `${e.id}.${L.exts[0]}` : e.id);
            return { lang: v.lang, name: L ? L.name : v.lang, file, write: L ? L.write : null, text: v.text };
          }),
        };
        if (!h.title) say(e, 'add "title:".');
        if (!GROUPS.some(g => g.id === p.group)) say(e, `"group: ${p.group}" isn't a group. Use one of: ${GROUPS.map(g => g.id).join(', ')}.`);
        if (!h.about) say(e, 'add "about:", one line on what it is.');
        if (!h.summary) say(e, 'add "summary:", what it does and why, in plain words.');
        for (const s of p.sources) {
          if (!s.name || !s.what) say(e, `"source: ${s.name}" needs a name | address | what was taken from it.`);
          if (s.url && !isUrl(s.url)) say(e, `"source: ${s.name}": "${s.url}" isn't a web address.`);
        }
        if (!p.variants.length) say(e, 'add at least one "== language file" with its text.');
        for (const v of p.variants) {
          const L = LANGS && LANGS.byId(v.lang);
          if (LANGS && !L) { say(e, `"== ${v.lang}" isn't a language id in lang/languages.js.`); continue; }
          if (!v.text.trim()) say(e, `"== ${v.lang} ${v.file}" has nothing under it.`);
          const ext = (v.file.match(/\.([A-Za-z0-9]+)$/) || [])[1];
          if (L && ext && !L.exts.includes(ext.toLowerCase()) && !(EXTRA_EXTS[v.lang] || []).includes(ext.toLowerCase()) && LANGS.fromPath(v.file) !== v.lang && LANGS.fromPath(v.file) !== 'text')
            say(e, `"${v.file}" is a ${LANGS.byId(LANGS.fromPath(v.file)).name} file name, but the variant says ${L.name}.`);
        }
        if (p.group === 'integration' && new Set(p.variants.map(v => v.file)).size < 2) say(e, 'a Coding integration part gives both sides: at least two files.');
        parts.push(p); partById[p.id] = p;
      }
    }
    // the links between types and parts, both ways
    const kits = root.IntuiBuilder && root.IntuiBuilder.library && root.IntuiBuilder.library.kits;
    for (const t of types) {
      for (const id of t.partIds) if (!partById[id]) errors.push(`type ${t.id}: lists a part "${id}" that doesn't exist.`);
      if (kits) for (const k of t.templates) if (!kits[k]) errors.push(`type ${t.id}: "templates: ${k}" isn't a Project Template (a kit in lang/builder.js or lang/kits).`);
    }
    for (const p of parts) for (const id of p.typeIds) if (!typeById[id]) errors.push(`part ${p.id}: "types: ${id}" isn't a type.`);
    const order = Object.fromEntries(GROUPS.map((g, i) => [g.id, i]));
    for (const t of types) {
      const ids = t.partIds.filter(id => partById[id]);
      const more = parts.filter(p => p.typeIds.includes(t.id) && !ids.includes(p.id)).sort((a, b) => (order[a.group] ?? 99) - (order[b.group] ?? 99)).map(p => p.id);
      t.parts = [...ids, ...more];
    }
    for (const p of parts) {
      p.types = types.filter(t => t.parts.includes(p.id)).map(t => t.id);
      if (!p.types.length) errors.push(`part ${p.id}: no type lists it. Add it to a type's "parts:" line, or give it "types:".`);
    }
    const headings = [...new Set(types.map(t => t.heading).filter(Boolean))];
    return { types, parts, groups: GROUPS, headings, errors, typeById, partById };
  }

  let cache = null;
  /* The built-in catalog, from the packs loaded so far. */
  function catalog() {
    const packs = root.IntuiLibraryPacks || [];
    if (!cache || cache.n !== packs.length) cache = { n: packs.length, cat: build(packs) };
    return cache.cat;
  }

  const part = (id) => catalog().partById[id] || null;
  const type = (id) => catalog().typeById[id] || null;
  /* The parts a kind of project is usually made of: its own list first, then parts that name it. */
  const partsFor = (typeId) => { const c = catalog(), t = c.typeById[typeId]; return t ? t.parts.map(id => c.partById[id]) : []; };
  const typesFor = (partId) => { const c = catalog(), p = c.partById[partId]; return p ? p.types.map(id => c.typeById[id]) : []; };
  /* A part's text in each language it is written in: [{ lang, name, file, write, text }]. */
  const variants = (partId) => { const p = part(partId); return p ? p.variants.map(v => ({ ...v })) : []; };
  /* A part in one language (the first variant in it), or null. */
  const forLanguage = (partId, lang) => variants(partId).find(v => v.lang === lang) || null;

  root.IntuiLibrary = { GROUPS, PLATFORMS, parseEntry, catalog, catalogFrom: build, type, part, partsFor, typesFor, variants, forLanguage };
})(typeof window !== 'undefined' ? window : globalThis);

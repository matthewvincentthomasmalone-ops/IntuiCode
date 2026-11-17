/* IntuaCode — the change log: what changed in the project's code, and by whom.
 *
 * Like a broadcast router's log, each entry says what changed and where the change came from (its origin):
 *
 *   you        typed in IntuaCode (a burst of typing is one entry)
 *   intuacode  something IntuaCode did when you asked: a fix used, a promise added, your part put back
 *   outside    found on disk: the code wasn't what IntuaCode last wrote (an AI, another editor, Git)
 *
 * What an entry says changed is never a claim: it's worked out by comparing the code before with the code after
 * (the code files as they're written to disk, not the sentences). The origin is the way the change came in, so
 * "outside" says it came from outside IntuaCode, not who made it; any evidence of who (your AI ticked tasks.md)
 * is listed as evidence.
 *
 *   diff(a, b)                         -> [{ at, to, del: [lines], add: [lines] }]   at/to: 0-based lines in a/b
 *   entry({ before, after, langs, definitions }) -> { files: [...] } or null when no code changed
 *       before, after: Map(path -> code); langs: Map(path -> language); definitions(lang, code, path) -> named parts
 *   summary(entry)                     -> one plain sentence ("You changed handleSave in src/App.tsx (+2 −1).")
 *   checked(log)                       -> the entries of a log read back from a project file, each checked, or []
 *   capped(log)                        -> the newest MAX_ENTRIES entries
 *   ORIGINS                            -> each origin's name and what it means
 *
 * No page here (no DOM): the app and the tests both use it.
 */
(function (root) {
  'use strict';

  const MAX_ENTRIES = 300;       // entries kept in a project's log
  const MAX_LINES = 160;         // lines of diff kept per file in an entry (the counts are always whole)
  const MAX_LINE_LEN = 400;      // characters kept of one line
  const MAX_CELLS = 2e6;         // a middle bigger than this (lines × lines) is said as one replaced block

  const ORIGINS = {
    you: { name: 'You', says: 'Typed in IntuaCode.' },
    intuacode: { name: 'IntuaCode', says: 'Done by IntuaCode when you asked: a fix used, a promise added, your part put back.' },
    outside: { name: 'Outside IntuaCode', says: 'Found on disk: the code wasn\'t what IntuaCode last wrote. An AI, another editor or Git changed it.' },
  };

  const linesOf = (code) => { const s = String(code == null ? '' : code).replace(/\r\n?/g, '\n').replace(/\n+$/, ''); return s ? s.split('\n') : []; };

  /* The lines that changed from a to b, as blocks: each block's lines taken out of a (del, from line `at`) and put in
     (add, at line `to` of b). The longest run of lines kept in place (LCS), after the same start and end are set aside. */
  function diff(a, b) {
    const A = Array.isArray(a) ? a : linesOf(a), B = Array.isArray(b) ? b : linesOf(b);
    let s = 0;
    while (s < A.length && s < B.length && A[s] === B[s]) s++;
    let ea = A.length, eb = B.length;
    while (ea > s && eb > s && A[ea - 1] === B[eb - 1]) { ea--; eb--; }
    const n = ea - s, m = eb - s;
    if (!n && !m) return [];
    if (!n || !m || n * m > MAX_CELLS) return [{ at: s, to: s, del: A.slice(s, ea), add: B.slice(s, eb) }];
    // lengths of the longest common run from (i, j) on, row by row (Uint32: a big file's middle fits)
    const W = m + 1, L = new Uint32Array((n + 1) * W);
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        L[i * W + j] = A[s + i] === B[s + j] ? L[(i + 1) * W + j + 1] + 1 : Math.max(L[(i + 1) * W + j], L[i * W + j + 1]);
      }
    }
    const out = [];
    let i = 0, j = 0, cur = null;
    const open = () => (cur = cur || { at: s + i, to: s + j, del: [], add: [] });
    const close = () => { if (cur) out.push(cur); cur = null; };
    while (i < n || j < m) {
      if (i < n && j < m && A[s + i] === B[s + j]) { close(); i++; j++; }
      else if (j < m && (i === n || L[i * W + j + 1] >= L[(i + 1) * W + j])) { open().add.push(B[s + j]); j++; }
      else { open().del.push(A[s + i]); i++; }
    }
    close();
    return out;
  }

  const PART_KINDS = new Set(['fn', 'class', 'component', 'rule', 'table']);
  /* The named parts a block of lines falls in: the smallest part around each changed line (in the code after, or
     before for lines only taken out). */
  function partsTouched(blocks, defsBefore, defsAfter) {
    const names = [];
    const smallest = (defs, line) => {
      let best = null;
      for (const d of defs) if (d.from <= line && line <= d.to && (!best || d.to - d.from < best.to - best.from)) best = d;
      return best;
    };
    for (const k of blocks) {
      const hits = [];
      if (k.add.length) for (let l = k.to; l < k.to + k.add.length; l++) hits.push(smallest(defsAfter, l));
      else for (let l = k.at; l < k.at + k.del.length; l++) hits.push(smallest(defsBefore, l));
      for (const d of hits) if (d && !names.includes(d.name)) names.push(d.name);
    }
    return names.slice(0, 12);
  }

  /* What changed between two sets of files: each file's blocks, counts and the parts they fall in. null: nothing. */
  function entry({ before, after, langs, definitions }) {
    const paths = [...new Set([...before.keys(), ...after.keys()])].sort();
    const files = [];
    for (const path of paths) {
      const was = before.has(path) ? linesOf(before.get(path)) : null, now = after.has(path) ? linesOf(after.get(path)) : null;
      if (was && now && was.length === now.length && was.every((l, i) => l === now[i])) continue;
      const status = !was ? 'added' : !now ? 'removed' : 'changed';
      const blocks = diff(was || [], now || []);
      if (status === 'changed' && !blocks.length) continue;
      const lang = (langs && langs.get(path)) || '';
      const defs = (code) => { try { return definitions ? definitions(lang, code, path).filter(d => PART_KINDS.has(d.kind)) : []; } catch (_) { return []; } };
      const parts = definitions ? partsTouched(blocks, was ? defs(before.get(path)) : [], now ? defs(after.get(path)) : []) : [];
      // the lines themselves, up to MAX_LINES for the file (the counts are always whole)
      let room = MAX_LINES, more = 0;
      const kept = [];
      for (const k of blocks) {
        const take = (xs) => { const t = xs.slice(0, Math.max(0, room)); room -= t.length; more += xs.length - t.length; return t.map(x => x.length > MAX_LINE_LEN ? x.slice(0, MAX_LINE_LEN) + '…' : x); };
        if (room <= 0) { more += k.del.length + k.add.length; continue; }
        kept.push({ at: k.at, to: k.to, del: take(k.del), add: take(k.add) });
      }
      files.push({
        path, status, parts,
        added: blocks.reduce((n, k) => n + k.add.length, 0),
        removed: blocks.reduce((n, k) => n + k.del.length, 0),
        blocks: kept, ...(more ? { more } : {}),
      });
    }
    return files.length ? { files } : null;
  }

  const counts = (f) => `+${f.added} −${f.removed}`;
  const list = (xs) => (xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1]);
  /* One plain sentence: who, what and where. */
  function summary(e) {
    const who = e.origin === 'you' ? 'You' : e.origin === 'intuacode' ? 'IntuaCode' : 'Outside IntuaCode, someone';
    const fs = e.files || [];
    const said = fs.slice(0, 3).map(f => {
      if (f.status === 'added') return `added ${f.path} (${f.added} line${f.added === 1 ? '' : 's'})`;
      if (f.status === 'removed') return `removed ${f.path}`;
      return `changed ${f.parts.length ? list(f.parts.slice(0, 3)) + (f.parts.length > 3 ? ' and more' : '') + ' in ' : ''}${f.path} (${counts(f)})`;
    });
    const rest = fs.length > 3 ? ` and ${fs.length - 3} more file${fs.length - 3 > 1 ? 's' : ''}` : '';
    return `${who} ${list(said)}${rest}.`;
  }

  /* A log read back from a project file (someone else's, perhaps): only entries of the right shape, with plain
     strings and numbers, cut to size, so nothing odd reaches the page. */
  const str = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');
  const nat = (v) => (Number.isInteger(v) && v >= 0 ? v : 0);
  const strs = (v, n, len) => (Array.isArray(v) ? v.filter(x => typeof x === 'string').slice(0, n).map(x => x.slice(0, len)) : []);
  function checked(log) {
    if (!Array.isArray(log)) return [];
    return capped(log.filter(e => e && typeof e === 'object' && ORIGINS[e.origin] && typeof e.at === 'string' && /^\d{4}-\d\d-\d\dT[\d:.]+Z$/.test(e.at) && Array.isArray(e.files)).map(e => ({
      id: str(e.id, 40) || e.at,
      at: e.at,
      origin: e.origin,
      what: str(e.what, 300),
      files: e.files.slice(0, 60).filter(f => f && typeof f.path === 'string' && f.path && ['added', 'removed', 'changed'].includes(f.status)).map(f => ({
        path: f.path.slice(0, 300), status: f.status, parts: strs(f.parts, 12, 120), added: nat(f.added), removed: nat(f.removed),
        ...(f.mine === true ? { mine: true } : {}),
        blocks: (Array.isArray(f.blocks) ? f.blocks : []).slice(0, MAX_LINES).filter(k => k && typeof k === 'object').map(k => ({ at: nat(k.at), to: nat(k.to), del: strs(k.del, MAX_LINES, MAX_LINE_LEN + 1), add: strs(k.add, MAX_LINES, MAX_LINE_LEN + 1) })),
        ...(nat(f.more) ? { more: nat(f.more) } : {}),
      })),
      ...(e.promises && typeof e.promises === 'object' ? { promises: { broke: strs(e.promises.broke, 20, 300), mended: strs(e.promises.mended, 20, 300) } } : {}),
      ...(Array.isArray(e.evidence) ? { evidence: strs(e.evidence, 10, 300) } : {}),
    })).filter(e => e.files.length));
  }
  const capped = (log) => (log.length > MAX_ENTRIES ? log.slice(log.length - MAX_ENTRIES) : log);

  root.IntuiLog = { ORIGINS, MAX_ENTRIES, diff, entry, summary, checked, capped, linesOf };
})(typeof window !== 'undefined' ? window : globalThis);

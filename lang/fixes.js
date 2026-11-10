/* IntuaCode — fixes for a line with a problem, made from the line itself and checked before they're offered.
 *
 *   suggest(line, opts) -> [{ text, why, kind, warns }], best first (at most opts.limit); warns: warnings it leaves
 *     line            the line as written; a fix keeps its indent
 *     opts.check(t)   -> { errs, warns } | null: t translated in the line's place, the problems of all its lines
 *                     (t can be two lines, for "when …, …"; the app compiles the file with it)
 *     opts.errs       the line's problems: the words they suggest are tried ("Did you mean "set"?", "CSS has … white")
 *     opts.words      the words the language's sentences use, for spelling
 *     opts.values     words that are values (CSS's colour names): spelled, but never left out
 *     opts.names      the names the project has (elements, groups, variables), for spelling
 *     opts.patterns   the closest sentences IntuaCode knows, with ‹blanks›: tried with the line's own values in them
 *     opts.limit = 3, opts.tries = 40 (lines translated at most), opts.budget = 250 (ms), opts.now = Date.now
 *   marks(before, after) -> [[text, isNew]]: after, in pieces, with the pieces that aren't in before marked
 *   dist(a, b)           -> how many letters differ (one left out, added, changed or two swapped is 1)
 *
 * A fix is a small change to what was written: a word or a name spelled the way IntuaCode knows it, what the
 * problem itself suggests, a word left out, or the closest sentence with the line's own values in its blanks.
 * Each is translated first, and only those that come out with no problems are given: a fix offered works.
 * Rules only, no guessing service. No page here (no DOM): the app and the tests both use it.
 */
(function (root) {
  'use strict';

  /* The pieces of a line, each with where it is: quoted text, colour codes, numbers, words and marks.
     (A ' only starts quoted text at the start of a word, so "don't" stays one word.) */
  const PIECE = /"[^"]*"|(?<![\w'])'[^']*'(?![\w])|#[0-9a-f]+\b|-?\d+(?:\.\d+)?%?|[a-z][\w'-]*|[^\s\w]/gi;
  function pieces(line) {
    const out = [];
    for (const m of String(line).matchAll(PIECE)) {
      const t = m[0];
      const kind = /^["']/.test(t) ? 'quote' : /^#[0-9a-f]+$/i.test(t) ? 'hex' : /^-?\d/.test(t) ? 'num' : /^[a-z]/i.test(t) ? 'word' : 'mark';
      out.push({ t, at: m.index, end: m.index + t.length, kind });
    }
    return out;
  }

  /* Letters apart, with two swapped counting as one (optimal string alignment). Stops early past max. */
  function dist(a, b, max = Infinity) {
    a = String(a).toLowerCase(); b = String(b).toLowerCase();
    if (a === b) return 0;
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let prev2 = null, prev = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      let low = i;
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        let d = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
        if (prev2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d = Math.min(d, prev2[j - 2] + 1);
        cur.push(d);
        if (d < low) low = d;
      }
      if (low > max) return max + 1;
      prev2 = prev; prev = cur;
    }
    return prev[b.length];
  }
  // words every writer reads inside a sentence, though few patterns show them: comparisons and joining words
  const COMMON = ('is are not and or than equal to the same as greater more bigger higher larger over above less smaller lower fewer under below ' +
    'at least most plus minus times divided by mod of in with from true false yes no nothing').split(' ');
  // how far a word may be from the one meant: one letter in a short word, two in a longer one
  const reach = (w) => (w.length <= 2 ? 0 : w.length <= 4 ? 1 : 2);

  const q = (s) => `"${s}"`;
  const splice = (line, at, end, text) => line.slice(0, at) + text + line.slice(end);
  /* Take a piece out with the space on one side of it, so no double space is left. */
  function cut(line, p) {
    let at = p.at, end = p.end;
    if (line[end] === ' ') end++; else if (line[at - 1] === ' ') at--;
    return line.slice(0, at) + line.slice(end);
  }

  /* What the problems suggest, word for word: their `code` and "quoted" parts, and lists like "CSS has a, b, c." */
  function suggested(errs) {
    const out = [];
    for (const e of errs || []) {
      for (const m of String(e).matchAll(/`([^`]+)`|"([^"]+)"/g)) out.push((m[1] || m[2]).trim());
      for (const m of String(e).matchAll(/\b(?:has|have|are|is one of|like)\s+((?:[\w#-]+(?:,\s*|\s+or\s+|\s+and\s+))+[\w#-]+)\./g)) {
        out.push(...m[1].split(/,\s*|\s+or\s+|\s+and\s+/).map(s => s.trim()));
      }
    }
    return [...new Set(out)].filter(s => s && s.length <= 48 && !/[‹›]/.test(s));
  }

  /* Each way to pick k of the values, keeping their order (at most cap of them). */
  function choose(list, k, cap = 6) {
    const out = [];
    const walk = (from, got) => {
      if (out.length >= cap) return;
      if (got.length === k) { out.push(got); return; }
      for (let i = from; i <= list.length - (k - got.length); i++) walk(i + 1, [...got, list[i]]);
    };
    walk(0, []);
    return out;
  }

  function suggest(line, opts = {}) {
    const check = opts.check;
    if (typeof check !== 'function') return [];
    const raw = String(line), indent = raw.match(/^\s*/)[0], text = raw.trim();
    if (!text) return [];
    const limit = opts.limit || 3, tries = opts.tries || 40, budget = opts.budget || 250, now = opts.now || Date.now, t0 = now();
    const low = (s) => String(s).toLowerCase();
    const words = new Set([...(opts.words || []), ...COMMON].map(low)), valueWords = new Set([...(opts.values || [])].map(low));
    const names = [...new Set((opts.names || []).map(String).filter(n => /^[a-z_][\w -]*$/i.test(n) && n.length > 1))];
    const nameSet = new Set(names.map(low)), nameWords = new Set(names.flatMap(n => low(n).split(/\s+/)).filter(w => w.length > 1));
    const isName = (w) => nameSet.has(low(w)) || nameWords.has(low(w));
    const known = (w) => words.has(low(w)) || valueWords.has(low(w)) || isName(w);
    const ps = pieces(text);
    const errs = (opts.errs || []).map(String);

    const found = [], tried = new Set([text]);
    let n = 0;
    // try a line (or a block of lines, for "when …, …"): kept when it translates with no problems
    const tryLine = (t, why, kind, score) => {
      t = t.split('\n').map((l, k) => (k ? l.replace(/\s+$/, '') : l.replace(/\s{2,}/g, ' ').trim())).join('\n');
      if (!t.trim() || tried.has(t) || /[‹›]/.test(t) || found.length >= limit || n >= tries || now() - t0 > budget) return false;
      tried.add(t);
      n++;
      let res = null;
      try { res = check(indent + t); } catch (_) { res = null; }
      if (!res || (res.errs || []).length) return false;
      found.push({ text: indent + t, why, kind, warns: (res.warns || []).map(String), score: score + ((res.warns || []).length ? 0.5 : 0) });
      return true;
    };

    /* Each word's possible replacements, best first: what the problem suggests for it, then the words and names
       IntuaCode knows that are spelled nearly the same. '' takes the word out. */
    const alts = new Map();
    const alt = (p, to, why, rank) => {
      const list = alts.get(p) || alts.set(p, []).get(p);
      if (!list.some(a => a.to === to)) list.push({ to, why, rank });
    };
    const pieceOf = (x) => ps.find(p => p.t === x);

    // 1. the problem's own advice: "Leave out `colour`", "Did you mean "set"?", "CSS has … white", "`#abc`". Only a
    //    near word: a problem's example ("a CSS property like "letter-spacing 2px"") shows the kind of thing to write.
    for (const e of errs) for (const m of e.matchAll(/Leave out `([^`]+)`/g)) {
      const p = pieceOf(m[1]);
      // (a misspelt word, "colur", is better spelled right than left out: it was meant)
      if (p) alt(p, '', `leaves out ${q(m[1])}, as the problem says`, known(m[1]) ? 0 : 1.5);
      else if (text.includes(m[1])) tryLine(text.replace(m[1] + ' ', '').replace(' ' + m[1], ''), `leaves out ${q(m[1])}, as the problem says`, 'said', 1);
    }
    const said = suggested(errs), inLine = said.filter(s => text.includes(s)), offered = said.filter(s => !text.includes(s));
    const close = (x, y) => dist(x, y, 9) <= Math.max(2, Math.ceil(y.length / 2));
    for (const y of offered) {
      for (const x of inLine) {
        if (x === y || !close(x, y)) continue;
        const p = pieceOf(x);
        if (p) alt(p, y, `${q(x)} → ${q(y)}, as the problem says`, dist(x, y) / 10);
        else tryLine(text.replace(x, y), `${q(x)} → ${q(y)}, as the problem says`, 'said', 1);
      }
      if (/^[\w-]+$/.test(y)) {
        const near = ps.filter(p => p.kind === 'word' && !known(p.t) && close(p.t, y)).sort((a, b) => dist(a.t, y) - dist(b.t, y))[0];
        if (near) alt(near, y, `${q(near.t)} → ${q(y)}, as the problem says`, dist(near.t, y) / 10);
      }
    }

    // 2. spelling: the words and names IntuaCode knows that are nearly the same (a typo usually keeps the start,
    //    so a longer shared start wins a tie). A word after "called" or "named" is a new name: it stays as it is.
    const pool = [...new Set([...words, ...valueWords, ...names, ...nameWords])];
    const start = (a, b) => { let k = 0; while (k < a.length && k < b.length && a[k] === b[k]) k++; return k; };
    const keepCase = (from, to) => (isName(to) && !words.has(low(to)) ? to : /^[A-Z]/.test(from) && !/^[A-Z]/.test(to) ? to[0].toUpperCase() + to.slice(1) : to);
    ps.forEach((p, k) => {
      const w = p.t, max = reach(w);
      if (p.kind !== 'word' || !max || known(w) || (k > 0 && /^(?:called|named)$/i.test(ps[k - 1].t))) return;
      pool.map(c => [dist(w, c, max), c]).filter(([d]) => d <= max)
        .sort((a, b) => a[0] - b[0] || start(low(w), low(b[1])) - start(low(w), low(a[1])) || a[1].length - b[1].length)
        .slice(0, 3).forEach(([d, c], r) => alt(p, keepCase(w, c), `${q(w)} → ${q(keepCase(w, c))}`, 1 + d / 10 + r / 100));
    });

    // each change on its own, then, when no one change does it, two or more together (the best two of each word)
    const fixed = (changes) => {
      let t = text;
      for (const [p, a] of [...changes].sort((x, y) => y[0].at - x[0].at)) t = a.to ? splice(t, p.at, p.end, a.to) : cut(t, p);
      return t;
    };
    const singles = [...alts].flatMap(([p, list]) => list.map(a => [p, a])).sort((x, y) => x[1].rank - y[1].rank);
    for (const [p, a] of singles) tryLine(fixed([[p, a]]), a.why, a.rank < 1 ? 'said' : 'spelling', 1 + a.rank / 10);
    if (!found.length && alts.size > 1) {
      let combos = [[]];
      for (const [p, list] of alts) combos = combos.flatMap(c => list.slice(0, 2).map(a => [...c, [p, a]]));
      combos.sort((x, y) => x.reduce((s, [, a]) => s + a.rank, 0) - y.reduce((s, [, a]) => s + a.rank, 0));
      for (const c of combos.slice(0, 8)) tryLine(fixed(c), [...c].sort((x, y) => x[0].at - y[0].at).map(([, a]) => a.why.replace(/, as the problem says$/, '')).join('; '), 'spelling', 1.3);
    }

    // 3. a word too many: one of the sentences' own words that the problem points at (in its quoted part), left
    //    out. Only those: leaving out any word that makes the line work could change what it means ("background
    //    colour #a9a9a9" without "background" is the text colour).
    const pointed = new Set(said.flatMap(s => low(s).split(/\s+/)));
    for (const p of ps) if (p.kind === 'word' && pointed.has(low(p.t)) && words.has(low(p.t)) && !valueWords.has(low(p.t)) && !isName(p.t)) tryLine(cut(text, p), `leaves out ${q(p.t)}`, 'extra', 2);

    // 4. two things in one line ("when buy is clicked, show "hi""): the second goes on its own line, inside the
    //    first. As written, then with the spellings above.
    const comma = ps.find(p => p.t === ',');
    if (comma && !/:$/.test(text)) {
      const block = (t, why) => {
        const at = t.indexOf(','), head = t.slice(0, at).trim(), rest = t.slice(at + 1).trim();
        if (at > 0 && head && rest) tryLine(`${head}:\n${indent}    ${rest}`, `puts ${q(rest)} on its own line, inside ${q(head + ':')}` + (why ? `; ${why}` : ''), 'block', 2.5);
      };
      block(text, '');
      for (const [p, a] of singles.filter(([p]) => p.at < comma.at).slice(0, 4)) block(fixed([[p, a]]), a.why.replace(/, as the problem says$/, ''));
    }

    // 5. when nothing smaller works: the closest sentence that takes every value the line has (text in quotes,
    //    numbers, colour codes and colours, names, words no sentence has that aren't a misspelling of one), in the
    //    order written, and leaves out at most two of its other words. Text in quotes goes in a quoted blank only.
    if (!found.length) {
      const values = ps.filter(p => !alts.has(p) && (p.kind === 'quote' || p.kind === 'hex' || p.kind === 'num' || (p.kind === 'word' && (isName(p.t) || valueWords.has(low(p.t)) || !words.has(low(p.t))))));
      for (const pat of opts.patterns || []) {
        const slots = String(pat).match(/"?‹[^›]*›"?/g) || [];
        if (!values.length || slots.length !== values.length || !slots.every((s, k) => /^".*"$/.test(s) === (values[k].kind === 'quote'))) continue;
        let k = 0;
        const t = String(pat).replace(/"?‹[^›]*›"?/g, (slot) => (/^".*"$/.test(slot) ? values[k++].t.replace(/^'|'$/g, '"') : values[k++].t));
        const lost = marks(t, text).filter(([s, isNew]) => isNew && /\w/.test(s)).flatMap(([s]) => s.trim().split(/\s+/));
        if (lost.length > 2) continue;
        tryLine(t, `the sentence ${q(String(pat))}, with your ${values.map(p => p.t).join(' and ')}` + (lost.length ? `, in place of ${lost.map(q).join(' and ')}` : ''), 'sentence', 3 + lost.length / 10);
      }
    }

    return found.sort((a, b) => a.score - b.score).map(({ text: t, why, kind, warns }) => ({ text: t, why, kind, warns }));
  }

  /* after, in pieces, marking what isn't in before (by the longest run they share), so the change can be shown. */
  function marks(before, after) {
    const a = pieces(String(before).trim()).map(p => p.t.toLowerCase()), src = String(after), b = pieces(src);
    const L = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
    for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) L[i][j] = a[i] === b[j].t.toLowerCase() ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    const isNew = new Array(b.length).fill(true);
    for (let i = 0, j = 0; i < a.length && j < b.length;) {
      if (a[i] === b[j].t.toLowerCase()) { isNew[j] = false; i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) i++; else j++;
    }
    const out = [];
    let pos = 0;
    b.forEach((p, j) => {
      const gap = src.slice(pos, p.at), last = out[out.length - 1];
      if (last && last[1] === isNew[j]) last[0] += gap + p.t;   // new words side by side are one change
      else { if (gap) out.push([gap, false]); out.push([p.t, isNew[j]]); }
      pos = p.end;
    });
    if (pos < src.length) out.push([src.slice(pos), false]);
    return out;
  }

  root.IntuiFixes = { suggest, marks, dist, pieces, suggested };
})(typeof window !== 'undefined' ? window : globalThis);

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
    if (/^(?:python|html|css|js|c\+\+)\s*:/i.test(s)) return false;
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

  root.IntuiPredict = { history, rest, after, nextWord, remember, worth };
})(typeof window !== 'undefined' ? window : globalThis);

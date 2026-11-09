/* IntuaCode — what a half-typed or unrecognised sentence probably means: the known sentences closest to it.
 *
 * Predictive Mode used to look only at how a sentence starts, so "add a data graph" or "add a border" found
 * nothing. This compares meanings instead: the typed words and each known sentence's words are reduced to
 * shared meanings (graph, chart, plot and canvas are one meaning; border, outline and edge another), and the
 * sentences that share the most are offered, best first. A sentence from another file (borders belong in
 * Styling, clicks in Mechanics) can be offered too, marked with where it goes.
 *
 *   match(typed, templates, opts) -> [{ t, pattern, score, other }]
 *        templates: [{ pattern, group, sections?, py? }] (a language pack's TEMPLATES)
 *        opts: { role: the file's role, for sentences that belong to a role (structure, styling, mechanics);
 *                extra: more templates from other files, each { pattern, group, role } (offered as "other");
 *                limit (default 5), min (default 0.5) }
 *   meanings(text) -> [meaning] the meanings in a text, in order (slots ‹…› and quoted text left out)
 *   SAME_MEANING -> the word groups
 *
 * No page here (no DOM): the app and the tests both use it.
 */
(function (root) {
  'use strict';

  /* Words that mean the same here, first word first. A word may be in one group only. */
  const SAME_MEANING = [
    ['chart', 'graph', 'plot', 'diagram', 'canvas', 'drawing', 'draw', 'visualise', 'visualize', 'visualisation', 'visualization', 'sketch'],
    ['box', 'container', 'panel', 'section', 'div', 'block', 'card', 'region', 'area', 'wrapper'],
    ['border', 'outline', 'edge', 'edges', 'stroke', 'bordered'],
    ['colour', 'color', 'colours', 'colors', 'background', 'bg', 'tint', 'shade', 'fill', 'coloured', 'colored',
      'red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink', 'black', 'white', 'grey', 'gray', 'navy', 'teal', 'gold',
      'silver', 'brown', 'cyan', 'magenta', 'maroon', 'olive', 'lime', 'aqua', 'tomato', 'skyblue', 'crimson', 'indigo', 'violet'],
    ['text', 'words', 'label', 'caption', 'paragraph', 'sentence', 'message', 'copy', 'writing'],
    ['heading', 'title', 'header', 'headline', 'heading1'],
    ['button', 'btn', 'buttons'],
    ['input', 'field', 'textbox', 'entry', 'textfield', 'form'],
    ['choose', 'dropdown', 'drop-down', 'select', 'menu', 'options', 'choices', 'choice', 'pick'],
    ['tick', 'checkbox', 'check', 'toggle', 'switch'],
    ['slider', 'range', 'dial', 'knob'],
    ['number', 'amount', 'quantity', 'count', 'digits', 'numeric', 'numbers'],
    ['picture', 'image', 'photo', 'img', 'logo', 'icon', 'pic', 'sprite'],
    ['link', 'url', 'href', 'hyperlink', 'website'],
    ['list', 'items', 'bullets', 'array', 'collection'],
    ['show', 'print', 'display', 'say', 'log', 'output', 'write', 'tell'],
    ['ask', 'prompt', 'question', 'query'],
    ['wait', 'pause', 'delay', 'sleep'],
    ['repeat', 'loop', 'times', 'again', 'forever', 'over', 'keep'],
    ['every', 'each', 'interval', 'per'],
    ['clicked', 'click', 'tap', 'tapped', 'press', 'pressed', 'clicks'],
    ['key', 'keyboard', 'keys', 'keypress'],
    ['save', 'store', 'remember', 'storage', 'persist'],
    ['fetch', 'load', 'download', 'get', 'request', 'api'],
    ['send', 'post', 'upload', 'submit', 'sent'],
    ['random', 'dice', 'roll', 'chance', 'randomly', 'luck'],
    ['sound', 'beep', 'tone', 'note', 'music', 'play', 'noise', 'buzzer'],
    ['hide', 'hidden', 'invisible', 'disappear', 'conceal'],
    ['rounded', 'round', 'corners', 'corner', 'radius', 'curved'],
    ['shadow', 'shadows', 'glow'],
    ['big', 'bigger', 'large', 'larger', 'size', 'width', 'height', 'small', 'smaller', 'tall', 'wide'],
    ['centre', 'center', 'centred', 'centered', 'middle', 'align'],
    ['row', 'horizontal', 'side', 'beside', 'inline'],
    ['column', 'vertical', 'stack', 'stacked'],
    ['screen', 'phone', 'mobile', 'narrow', 'responsive', 'small-screen', 'screens'],
    ['hover', 'hovered', 'mouseover', 'pointer'],
    ['led', 'light', 'lamp', 'lights', 'leds', 'blink', 'blinking', 'flash', 'flashing'],
    ['pin', 'pins', 'gpio'],
    ['sensor', 'analog', 'analogue', 'measure', 'potentiometer', 'temperature', 'distance'],
    ['read', 'reads', 'reading', 'readings', 'sample'],
    ['serial', 'monitor', 'console', 'terminal'],
    ['servo', 'motor'],
    ['time', 'clock', 'timer', 'seconds', 'second', 'milliseconds', 'millis', 'ms'],
    ['file', 'files', 'open', 'document', 'csv', 'txt'],
    ['define', 'function', 'tool', 'method', 'procedure', 'def', 'routine'],
    ['class', 'object', 'type', 'blueprint'],
    ['if', 'otherwise', 'else', 'unless', 'when', 'whenever', 'condition'],
    ['set', 'make', 'variable', 'value', 'name', 'create', 'let', 'called'],
    ['add', 'insert', 'put', 'append', 'include', 'new'],
    ['remove', 'delete', 'clear', 'erase', 'drop'],
    ['font', 'typeface', 'bold', 'italic', 'underline'],
    ['page', 'site', 'web', 'html', 'webpage'],
    ['style', 'styles', 'css', 'look', 'design', 'theme'],
    ['start', 'begin', 'starts', 'loaded', 'load-time', 'setup', 'ready'],
  ];
  /* More meanings for sentences whose own words don't say what people reach them for (by how they start). */
  const ALSO = [
    ['when ‹name› is clicked', 'button press tap'],
    ['turn pin', 'led light blink switch on off'],
    ['make pin', 'led output pin setup'],
    ['set the brightness of pin', 'led dim fade brightness'],
    ['read pin', 'button sensor input pressed read'],
    ['play a tone', 'buzzer beep sound speaker'],
    ['play a note', 'beep sound music'],
    ['start the serial monitor', 'serial debug print show'],
    ['add a drawing area', 'chart graph canvas game picture'],
    ['add a section', 'box container div group panel'],
    ['add a list called', 'bullets items'],
    ['add a text box', 'input field type name'],
    ['ask "', 'input question user name'],
    ['ask for a number', 'input user age amount'],
    ['shuffle', 'mix order'],
    ['wait', 'delay pause sleep'],
    ['every', 'timer repeat interval'],
    ['create group', 'class style look'],
    ['style', 'look css design'],
  ];
  const STOP = new Set(['a', 'an', 'the', 'to', 'of', 'on', 'in', 'into', 'with', 'and', 'my', 'some', 'it', 'its', 'for', 'at', 'by', 'from', 'that', 'this', 'is', 'be', 'as', 'there', 'please', 'i', 'want', 'need', 'would', 'like', 'can', 'you', 'me', 'so', 'then']);
  const MEANING = new Map();
  for (const group of SAME_MEANING) for (const w of group) if (!MEANING.has(w)) MEANING.set(w, group[0]);

  const stem = (w) => (w.length > 4 && w.endsWith('es') && !w.endsWith('ses') ? w.slice(0, -2) : w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w);
  const meaningOf = (w) => MEANING.get(w) || MEANING.get(stem(w)) || stem(w);

  /* The meanings in a text, in order: quoted text left out, little words dropped. A sentence pattern's ‹slots›
     count too (‹led›, ‹question› say what goes there), as does its ALSO line; a typed line's don't. */
  function meanings(text, isPattern) {
    let s = String(text || '').toLowerCase();
    if (isPattern) {
      const also = isPattern !== 'own' && ALSO.find(([start]) => s.startsWith(start));
      s = s.replace(/[‹›]/g, ' ') + (also ? ' ' + also[1] : '');
    } else s = s.replace(/‹[^›]*›?/g, ' ');
    s = s.replace(/"[^"]*"?|'[^']*'/g, ' ');
    const out = [];
    for (const w of s.match(/[a-z][a-z0-9-]*/g) || []) {
      if (STOP.has(w)) continue;
      const m = meaningOf(w);
      if (!out.includes(m)) out.push(m);
    }
    return out;
  }

  const ROLE_NAME = { structure: 'Structure (the page)', styling: 'Styling', mechanics: 'Mechanics' };
  const LIGHT = new Set(['add', 'set']);   // words in half the sentences: they count for less

  function match(typed, templates, opts = {}) {
    const want = meanings(typed);
    if (!want.length) return [];
    const limit = opts.limit || 5, min = opts.min ?? 0.5, role = opts.role;
    const lowTyped = String(typed).trim().toLowerCase();
    const all = (templates || []).concat(opts.extra || []);
    // a typed word no sentence knows (a name, a typo) counts for less, so it doesn't sink every match
    const known = new Set(all.flatMap(t => meanings(t.pattern, true)));
    const weightOf = (m) => (LIGHT.has(m) ? 0.5 : MEANING.has(m) || known.has(m) ? 1 : 0.3);
    const weight = want.reduce((n, m) => n + weightOf(m), 0);
    const scored = [];
    const consider = (t, other, where) => {
      const have = meanings(t.pattern, true);
      if (!have.length) return;
      // how much of what was typed the sentence covers; a sentence about much else counts a little less
      let hit = 0;
      for (const m of want) if (have.includes(m)) hit += weightOf(m);
      if (!hit) return;
      // a sentence that says much else counts a little less (its extra meanings aren't clutter, so they don't count)
      let score = hit / weight - Math.max(0, meanings(t.pattern, 'own').length - want.length - 2) * 0.02;
      if (t.pattern.toLowerCase().startsWith(lowTyped)) score += 0.3;   // it also starts the same way
      const words = new Set(t.pattern.toLowerCase().replace(/‹[^›]*›/g, ' ').match(/[a-z]+/g) || []);   // its own words, not its blanks'
      // "no border" is the opposite of "add a border": a "no" or "not" only fits when one was typed
      const neg = /\b(?:no|not|without|never)\b/;
      if (neg.test(t.pattern.toLowerCase()) !== neg.test(lowTyped)) score -= 0.2;
      for (const w of lowTyped.match(/[a-z]+/g) || []) if (!STOP.has(w) && words.has(w)) score += 0.04;   // the very words typed
      if (other) score -= 0.15;                                        // it goes in another file
      if (score >= min) scored.push({ t, pattern: t.pattern, score: Math.round(score * 100) / 100, other: other ? where : null });
    };
    for (const t of templates || []) {
      const sections = t.sections || [];
      const elsewhere = role && sections.length && !sections.includes(role);
      consider(t, !!elsewhere, elsewhere ? ROLE_NAME[sections[0]] || sections[0] : null);
    }
    for (const t of opts.extra || []) consider(t, t.role !== role, ROLE_NAME[t.role] || t.role);
    const seen = new Set();
    return scored.sort((a, b) => b.score - a.score || a.pattern.length - b.pattern.length)
      .filter(x => { const k = x.pattern.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })
      .slice(0, limit);
  }

  root.IntuiIntent = { match, meanings, SAME_MEANING };
})(typeof window !== 'undefined' ? window : globalThis);

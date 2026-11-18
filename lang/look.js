/* IntuaCode — Customise: the app's look, laid out as very simple code.
 *
 * Menu → Customise shows IntuaCode's look as blocks of plain lines, like CSS rules in words:
 *
 *   Editor {
 *     Text size = 14.5          -- 12 to 20
 *     Sentence parts = green
 *   }
 *
 * Only the values change. Seafoam values are the person's (each checked, used at once, remembered); pink values are
 * fixed, there so it reads as the whole of the look. What can change is a short list: colours, fonts and sizes, and
 * where three parts sit. Nothing that could break the layout or make text hard to read: every colour is checked
 * against the dark look it goes on, editor fonts must be fixed-width, sizes have a range.
 *
 *   SETTINGS                       -> [{ key, block, name, kind, def, note?, min?, max?, choices? }]  the seafoam values
 *   DEFAULTS                       -> { key: text }
 *   check(key, text, values, env)  -> { ok: true, value } or { ok: false, problem }   (values: the look as it is now)
 *       env (from the page, optional): fontInstalled(name) -> bool, fixedWidth(name) -> bool
 *   checked(stored, env)           -> the look from what was stored, each value checked again (wrong ones are left out)
 *   stored(values)                 -> what to store: only the values that aren't the defaults
 *   styleOf(values)                -> { vars: { '--accent': '#87ceeb', … }, classes: ['look-side-right', …] }
 *   VARS, CLASSES                  -> every variable and class styleOf can set (to take them off again)
 *   lines(values, info)            -> the window's lines: { t: note|blank|open|close|set|fixed, … }   info: { version }
 *   text(values, info)             -> the same, as text
 *   toHex(text), contrast(a, b)    -> '#rrggbb' or null; the WCAG contrast of two colours (1 to 21)
 *   SEAFOAM, PINK                  -> the colours the window shows its values in (app.css has the same; seafoam is the Predictive Mode button's)
 *
 * No page here (no DOM): the app and the tests both use it. Colour names come from lang/values.js when it's loaded.
 */
(function (root) {
  'use strict';

  const SEAFOAM = '#9FE2BF';   // a value that's yours to change
  const PINK = '#FF9FC6';      // a value that's fixed

  // what the colours are checked against: IntuaCode's look is dark, always
  const CHASSIS = '#16171A';   // the panels, the menus, the side
  const TERM_BG = '#040605';   // the terminal's black screen
  const NOTES = '#8C8287';     // notes (comments) in the code, the dimmest text on the editor's background
  const LINE_NO = '#91878C';   // line numbers and other quiet text

  // the typefaces that come with IntuaCode (fonts/), always there
  const BUNDLED = { 'Atkinson Hyperlegible Next': false, 'Atkinson Hyperlegible Mono': true, 'IBM Plex Mono': true };
  const GENERIC = { 'system-ui': false, 'sans-serif': false, serif: false, monospace: true, 'ui-monospace': true };

  const SETTINGS = [
    { key: 'accent', block: 'IntuaCode', name: 'Accent colour', kind: 'colour', def: '#E8AABA', note: 'links and outlines' },
    { key: 'text', block: 'IntuaCode', name: 'Text colour', kind: 'colour', def: '#ECE6E8' },
    { key: 'font', block: 'IntuaCode', name: 'Font style', kind: 'font', def: 'Atkinson Hyperlegible Next', note: 'menus, buttons, help' },
    { key: 'barAt', block: 'Menu bar', name: 'Sits at', kind: 'place', def: 'top', choices: ['top', 'bottom'] },
    { key: 'sideOn', block: 'Project side', name: 'Sits on', kind: 'place', def: 'left', choices: ['left', 'right'] },
    { key: 'helpOn', block: 'Help', name: 'Sits on', kind: 'place', def: 'right', choices: ['right', 'left'] },
    { key: 'editorFont', block: 'Editor', name: 'Font style', kind: 'mono', def: 'Atkinson Hyperlegible Mono', note: 'fixed-width fonts only' },
    { key: 'editorSize', block: 'Editor', name: 'Text size', kind: 'size', def: '14.5', min: 12, max: 20 },
    { key: 'background', block: 'Editor', name: 'Background', kind: 'colour', def: '#0A0B0D', note: 'dark colours only' },
    { key: 'highlight', block: 'Editor', name: 'Highlight', kind: 'colour', def: '#8FE4B9', note: 'what you select' },
    { key: 'codeFont', block: 'Code', name: 'Font style', kind: 'mono', def: 'IBM Plex Mono', note: 'fixed-width fonts only' },
    { key: 'codeSize', block: 'Code', name: 'Text size', kind: 'size', def: '13.5', min: 11, max: 20 },
    { key: 'words', block: 'Code', name: 'Words colour', kind: 'colour', def: '#F0A6B8', note: 'if, show, def…' },
    { key: 'quotes', block: 'Code', name: 'Text in quotes, colour', kind: 'colour', def: '#9FE6BF' },
    { key: 'numbers', block: 'Code', name: 'Numbers colour', kind: 'colour', def: '#F2C46B' },
    { key: 'glow', block: 'Terminal', name: 'Glow colour', kind: 'colour', def: '#A9F3C7', note: 'the terminal, and the word Run' },
  ];
  const BY_KEY = Object.fromEntries(SETTINGS.map(s => [s.key, s]));
  const DEFAULTS = Object.freeze(Object.fromEntries(SETTINGS.map(s => [s.key, s.def])));

  // The window, block by block: a seafoam value by its key, a pink one with its value and why it's fixed.
  const BLOCKS = [
    { name: 'IntuaCode', lines: [
      { name: 'Version', fixed: '', info: 'version', why: 'IntuaCode\'s version (Menu → About and licence).' },
      { name: 'Look', fixed: 'dark', why: 'IntuaCode has one look, a dark one. Every colour here is checked against it.' },
      'accent', 'text', 'font'] },
    { name: 'Menu bar', lines: ['barAt', { name: 'Buttons', fixed: 'Menu, Help, Run', why: 'The help names these buttons, so they stay.' }] },
    { name: 'Project side', lines: ['sideOn', { name: 'Width', fixed: '256', why: 'Fixed, so file names fit and the code keeps its room.' }] },
    { name: 'Help', lines: ['helpOn'] },
    { name: 'Editor', note: 'Unity, and the sentences in Split Mode', lines: ['editorFont', 'editorSize', 'background', 'highlight',
      { name: 'Sentence parts', fixed: 'green', why: 'The help calls them the green parts, so they stay green.' }] },
    { name: 'Code', note: 'the code side in Split Mode, and the terminal', lines: ['codeFont', 'codeSize', 'words', 'quotes', 'numbers'] },
    { name: 'Terminal', lines: [
      { name: 'Sits at', fixed: 'bottom', why: 'The terminal and the Preview share the bottom of the window.' },
      'glow',
      { name: 'Prompt', fixed: '"❯"', why: 'The terminal\'s prompt.' }] },
  ];

  /* ---------- colours ---------- */
  const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
  // a few names of IntuaCode's own, beside the CSS ones lang/values.js knows (skyblue, gold, tomato…)
  const OWN_NAMES = { seafoam: '#9fe2bf', amber: '#ffb000', mint: '#a8e6ce', rose: '#e8aaba', phosphor: '#a9f3c7' };
  function toHex(text) {
    const s = String(text == null ? '' : text).trim().toLowerCase();
    if (HEX.test(s)) return '#' + (s.length === 4 ? s.slice(1).replace(/./g, d => d + d) : s.slice(1));
    if (Object.prototype.hasOwnProperty.call(OWN_NAMES, s)) return OWN_NAMES[s];
    const V = root.IntuiValues;
    const h = V && /^[a-z ]+$/.test(s) ? V.toHex(s) : null;
    return h && /^#[0-9a-f]{6}$/.test(h) ? h : null;
  }
  const rgb = (hex) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  function luminance(hex) {
    const [r, g, b] = rgb(hex).map(c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  function contrast(a, b) {
    const la = luminance(toHex(a)), lb = luminance(toHex(b));
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }
  const rgba = (hex, a) => `rgba(${rgb(hex).join(', ')}, ${a})`;
  const mix = (hex, other, part) => '#' + rgb(hex).map((c, i) => Math.round(c * part + rgb(other)[i] * (1 - part)).toString(16).padStart(2, '0')).join('');

  // Each colour is checked where it goes. Too little contrast there: said why, in words, and not used.
  const TOO_DARK = 'Too dark to read on IntuaCode\'s dark background. Try a lighter colour.';
  const ON_EDITOR = 'Too dark to read on the editor\'s background. Try a lighter colour.';
  function colourProblem(key, hex, values) {
    const bg = toHex(values.background) || DEFAULTS.background;
    switch (key) {
      case 'accent': return contrast(hex, CHASSIS) < 3 ? 'Too dark to see on IntuaCode\'s dark background. Try a lighter colour.' : null;
      case 'text': return contrast(hex, CHASSIS) < 7 || contrast(hex, bg) < 7 ? TOO_DARK : null;
      case 'background': {
        // every colour the editor shows must still be readable on it, the dimmest first
        // (the same contrast each of them asks of the background in its own check)
        const on = [['notes (the grey comments)', NOTES, 4.5], ['line numbers', LINE_NO, 4.5], ['text', values.text, 7], ['words', values.words, 4.5],
          ['text in quotes', values.quotes, 4.5], ['numbers', values.numbers, 4.5], ['highlight (what you select)', values.highlight, 3]];
        const bad = on.find(([, c, least]) => contrast(toHex(c) || '#000000', hex) < least);
        return bad ? `Too light: the ${bad[0]} wouldn't be readable on it. IntuaCode's look is dark, so the background must be dark too.` : null;
      }
      case 'highlight': return contrast(hex, bg) < 3 ? 'Too dark: what you select wouldn\'t show on the background. Try a lighter colour.' : null;
      case 'words': case 'quotes': case 'numbers': return contrast(hex, bg) < 4.5 ? ON_EDITOR : null;
      case 'glow': return contrast(hex, TERM_BG) < 7 ? 'Too dark to read on the terminal\'s black screen. Try a lighter colour.' : null;
      default: return null;
    }
  }

  /* ---------- fonts ---------- */
  const unquote = (t) => String(t == null ? '' : t).trim().replace(/^(["'])(.*)\1$/, '$2').trim();
  const FONT_NAME = /^[A-Za-z0-9][A-Za-z0-9 ._+-]{0,59}$/;
  const familyOf = (name, rest) => (Object.prototype.hasOwnProperty.call(GENERIC, name) ? name : `"${name}"`) + ', ' + rest;
  function fontProblem(name, mono, env) {
    if (!name) return 'Write a font\'s name, like "Courier New".';
    if (!FONT_NAME.test(name)) return 'A font\'s name is letters, numbers and spaces, like "Courier New".';
    const known = Object.prototype.hasOwnProperty.call(BUNDLED, name) ? BUNDLED[name] : Object.prototype.hasOwnProperty.call(GENERIC, name) ? GENERIC[name] : null;
    if (known === null && env && env.fontInstalled && !env.fontInstalled(name)) return `"${name}" isn't a font on this computer.`;
    const fixed = known !== null ? known : env && env.fixedWidth ? env.fixedWidth(name) : true;
    if (mono && !fixed) return `"${name}" isn't fixed-width. In the editor every letter must be as wide as the others, or the marks under the text drift. Try one with "Mono" in its name.`;
    return null;
  }

  /* ---------- one value ---------- */
  function check(key, text, values, env) {
    const s = BY_KEY[key];
    if (!s) return { ok: false, problem: 'IntuaCode has no such setting.' };
    const now = Object.assign({}, DEFAULTS, values || {});
    const t = String(text == null ? '' : text).trim();
    if (s.kind === 'colour') {
      if (!t) return { ok: false, problem: 'Write a colour: a code like #9FE2BF, or a name like skyblue.' };
      const hex = toHex(t);
      if (!hex) return { ok: false, problem: `"${t}" isn't a colour IntuaCode knows. Write a code like #9FE2BF, or a name like skyblue.` };
      const problem = colourProblem(key, hex, now);
      return problem ? { ok: false, problem } : { ok: true, value: t };
    }
    if (s.kind === 'font' || s.kind === 'mono') {
      const name = unquote(t);
      const problem = fontProblem(name, s.kind === 'mono', env);
      return problem ? { ok: false, problem } : { ok: true, value: name };
    }
    if (s.kind === 'size') {
      const m = /^(\d+(?:\.\d+)?)\s*(?:px)?$/i.exec(t);
      if (!m) return { ok: false, problem: `Write a number, like ${s.def}.` };
      const n = Number(m[1]);
      if (n < s.min || n > s.max) return { ok: false, problem: `${s.name} goes from ${s.min} to ${s.max}.` };
      return { ok: true, value: String(Math.round(n * 10) / 10) };
    }
    if (s.kind === 'place') {
      const w = t.toLowerCase();
      return s.choices.includes(w) ? { ok: true, value: w } : { ok: false, problem: `${s.name} can be ${s.choices.join(' or ')}.` };
    }
    return { ok: false, problem: 'IntuaCode has no such setting.' };
  }

  /* ---------- the whole look ---------- */
  // What was stored, checked again in order (the background before the colours on it): anything not right now is left out.
  function checked(stored, env) {
    const out = Object.assign({}, DEFAULTS);
    if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return out;
    for (const s of SETTINGS) {
      if (typeof stored[s.key] !== 'string' || stored[s.key].length > 80) continue;
      const r = check(s.key, stored[s.key], out, env);
      if (r.ok) out[s.key] = r.value;
    }
    return out;
  }
  const changed = (values, key) => values[key] !== undefined && values[key] !== DEFAULTS[key];
  function stored(values) {
    const out = {};
    for (const s of SETTINGS) if (changed(values, s.key)) out[s.key] = values[s.key];
    return out;
  }

  const UI_REST = '"Segoe UI", system-ui, -apple-system, sans-serif';
  const MONO_REST = 'ui-monospace, Menlo, Consolas, monospace';
  const VARS = ['--accent', '--accent-ink', '--accent-soft', '--band', '--ink', '--f-ui', '--f-say', '--say-size', '--f-py', '--code-size', '--lh',
    '--field', '--sel', '--kw', '--str', '--num', '--term-ink', '--phosphor', '--term-dim'];
  const CLASSES = ['look-bar-bottom', 'look-side-right', 'look-help-left'];
  function styleOf(values) {
    const v = Object.assign({}, DEFAULTS, values || {}), vars = {}, classes = [];
    const hex = (k) => toHex(v[k]) || DEFAULTS[k];
    if (changed(v, 'accent')) {
      const a = hex('accent');
      vars['--accent'] = a;
      vars['--accent-ink'] = contrast(a, '#1C0F13') >= contrast(a, '#FFFFFF') ? '#1C0F13' : '#FFFFFF';   // the Run button's word
      vars['--accent-soft'] = rgba(a, 0.14);
      vars['--band'] = rgba(a, 0.075);   // the line you're on
    }
    if (changed(v, 'text')) vars['--ink'] = hex('text');
    if (changed(v, 'font')) vars['--f-ui'] = familyOf(v.font, UI_REST);
    if (changed(v, 'editorFont')) vars['--f-say'] = familyOf(v.editorFont, MONO_REST);
    if (changed(v, 'codeFont')) vars['--f-py'] = familyOf(v.codeFont, MONO_REST);
    if (changed(v, 'editorSize') || changed(v, 'codeSize')) {
      const say = Number(v.editorSize), code = Number(v.codeSize);
      vars['--say-size'] = say + 'px';
      vars['--code-size'] = code + 'px';
      vars['--lh'] = Math.round(Math.max(say, code) * 1.52) + 'px';   // 22px at the usual 14.5
    }
    if (changed(v, 'background')) vars['--field'] = hex('background');
    if (changed(v, 'highlight')) vars['--sel'] = rgba(hex('highlight'), 0.24);
    if (changed(v, 'words')) vars['--kw'] = hex('words');
    if (changed(v, 'quotes')) vars['--str'] = hex('quotes');
    if (changed(v, 'numbers')) vars['--num'] = hex('numbers');
    if (changed(v, 'glow')) {
      const g = hex('glow');
      vars['--term-ink'] = g;
      vars['--phosphor'] = g;
      // the dim lines (hints, the status): the glow, darker, but never too dark to read
      let part = 0.58;
      while (part < 1 && contrast(mix(g, TERM_BG, part), TERM_BG) < 4.5) part += 0.04;
      vars['--term-dim'] = mix(g, TERM_BG, Math.min(part, 1));
    }
    if (v.barAt === 'bottom') classes.push('look-bar-bottom');
    if (v.sideOn === 'right') classes.push('look-side-right');
    if (v.helpOn === 'left') classes.push('look-help-left');
    return { vars, classes };
  }

  /* ---------- the window's text ---------- */
  function lines(values, info) {
    const v = Object.assign({}, DEFAULTS, values || {}), out = [];
    out.push({ t: 'note', text: 'IntuaCode\'s look, written as code.' });
    out.push({ t: 'note', text: 'Change a seafoam value and it\'s used at once. The pink ones stay.' });
    for (const b of BLOCKS) {
      out.push({ t: 'blank' });
      out.push({ t: 'open', block: b.name, note: b.note });
      for (const l of b.lines) {
        if (typeof l === 'string') {
          const s = BY_KEY[l];
          out.push({ t: 'set', block: b.name, key: s.key, name: s.name, kind: s.kind, value: v[s.key], note: s.note || (s.kind === 'size' ? `${s.min} to ${s.max}` : s.choices ? s.choices.join(' or ') : '') });
        } else {
          out.push({ t: 'fixed', block: b.name, name: l.name, value: l.info ? String((info && info[l.info]) || '…') : l.fixed, why: l.why });
        }
      }
      out.push({ t: 'close' });
    }
    return out;
  }
  function text(values, info) {
    return lines(values, info).map(l => {
      const note = l.note ? `  -- ${l.note}` : '';
      if (l.t === 'note') return `-- ${l.text}`;
      if (l.t === 'blank') return '';
      if (l.t === 'open') return `${l.block} {${note}`;
      if (l.t === 'close') return '}';
      const value = l.kind === 'font' || l.kind === 'mono' ? `"${l.value}"` : l.value;
      return `  ${l.name} = ${value}${note}`;
    }).join('\n');
  }

  root.IntuiLook = { SETTINGS, DEFAULTS, BLOCKS, VARS, CLASSES, SEAFOAM, PINK, check, checked, stored, styleOf, lines, text, toHex, contrast };
})(typeof window !== 'undefined' ? window : globalThis);

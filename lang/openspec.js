/* IntuaCode — a project map as an OpenSpec change, for an AI assistant to work from.
 *
 * OpenSpec (openspec.dev) keeps a planned change as a folder of Markdown files:
 *
 *   openspec/changes/<name>/proposal.md     ## Why, ## What Changes, ## Impact
 *   openspec/changes/<name>/tasks.md        ## 1. Group, then - [ ] 1.1 Task (- [x] when done)
 *   openspec/changes/<name>/.openspec.yaml  the workflow it follows (spec-driven) and the day it was made
 *
 * Here the map's steps become the tasks, in build order, each with its "how to check it's done" line, and the
 * ticked ones come out as - [x]; ticks made in tasks.md later can be read back. The AI stays outside IntuaCode:
 * it gets these files and nothing else.
 *
 *   changeName(name)                  -> kebab-case id for the change folder ("My Site!" -> "my-site")
 *   progress(steps)                   -> { done, total, next }   next: the first step not done, or null
 *   proposal(plan, info)              -> proposal.md's text
 *   tasks(plan, info)                 -> tasks.md's text
 *   ticksFrom(text, steps)            -> the steps a tasks.md ticks (ticked by an AI, say) that the map hasn't
 *   files(plan, info)                -> [{ path, content }], the paths under openspec/changes/<name>/
 *   zip(files, date)                  -> Uint8Array: a .zip of them (stored, not compressed)
 *
 * plan: { title, path: [answers], steps: [{ n, name, depth, summary, usual, check, done }] }
 * info: { name: the project's name, files: [paths of its code files], date: 'YYYY-MM-DD' }
 * A step's check is used as given: the app fills in its depth's default first. No page here (no DOM).
 */
(function (root) {
  'use strict';

  const DEPTH = {
    walk: { label: 'Walk', state: 'written and runs', impact: 'Walk steps are written and run.' },
    hallway: { label: 'Hallway', state: 'laid out, with ‹blanks› to fill in', impact: 'Hallway steps leave ‹blanks› in the code to fill in.' },
    horizon: { label: 'Horizon', state: 'not written yet', impact: 'Horizon steps aren\'t written yet: choose how to make them.' },
  };
  const depthOf = (s) => DEPTH[s.depth] || DEPTH.horizon;
  const WHY_MIN = 50, WHY_MAX = 1000;   // openspec validate's limits for ## Why

  // One line, so text from a step can never start a heading or a task of its own.
  const line = (v) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
  const sentence = (v) => { const s = line(v); return !s || /[.!?:)]$/.test(s) ? s : s + '.'; };

  function changeName(name) {
    // accents go (café -> cafe), then anything but letters and digits becomes one dash
    const s = line(name).normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase().replace(/\.[a-z0-9]+$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '');
    return s || 'my-project';
  }

  function progress(steps) {
    const list = steps || [];
    const next = list.find(s => !s.done);
    return { done: list.filter(s => s.done).length, total: list.length, next: next ? next.n : null };
  }

  const titleOf = (plan, info) => line(plan.title) || line(info && info.name) || 'My project';
  const nameOf = (s) => line(s.name) || 'Step ' + s.n;

  function proposal(plan, info = {}) {
    const steps = plan.steps || [];
    const p = progress(steps);
    const name = line(info.name), title = titleOf(plan, info);
    const path = (plan.path || []).map(line).filter(Boolean);
    let why = `${name && name.toLowerCase() !== title.toLowerCase() ? `${name}: ` : ''}${title}${path.length ? ` (${path.join(' › ')})` : ''}. `
      + `Planned in IntuaCode's project map: ${p.total} step${p.total === 1 ? '' : 's'} in build order, ${p.done} done so far. `
      + 'Each step says how to check it\'s done, so the rest can be built and checked one step at a time.';
    if (why.length < WHY_MIN) why += ' Work through tasks.md in order.';
    if (why.length > WHY_MAX) why = why.slice(0, WHY_MAX - 1).replace(/\s+\S*$/, '') + '…';

    const what = steps.length ? steps.map(s => {
      const out = [`- **${s.n}. ${nameOf(s)}** (${depthOf(s).label}: ${depthOf(s).state}${s.done ? '; done' : ''}). ${sentence(s.summary) || 'No summary yet.'}`];
      if (line(s.usual)) out.push(`  Usually made with: ${sentence(s.usual)}`);
      return out.join('\n');
    }) : ['- No steps yet.'];

    const files = (info.files || []).map(line).filter(Boolean);
    const used = Object.keys(DEPTH).filter(d => steps.some(s => depthOf(s) === DEPTH[d]));
    const impact = [files.length ? `- Files: ${files.map(f => '`' + f + '`').join(', ')}.` : '- Files: none yet.'];
    if (used.some(d => d !== 'horizon')) impact.push('- A step with code starts at a comment that reads `── Step n · Name`.');
    if (used.length) impact.push('- ' + used.map(d => DEPTH[d].impact).join(' '));
    impact.push('- IntuaCode keeps the sentences behind the code in `.intuicode/`. Change the code files themselves, not that folder.');
    return `# Proposal: ${title}\n\n## Why\n\n${why}\n\n## What Changes\n\n${what.join('\n')}\n\n## Impact\n\n${impact.join('\n')}\n`;
  }

  function tasks(plan, info = {}) {
    const steps = plan.steps || [];
    const list = steps.length
      ? steps.map((s, i) => `- [${s.done ? 'x' : ' '}] 1.${i + 1} ${nameOf(s)} (${depthOf(s).label}).${line(s.check) ? ' Check: ' + sentence(s.check) : ''}`)
      : ['- [ ] 1.1 Plan the steps.'];
    return `# Tasks\n\nThe steps of ${titleOf(plan, info)}, in build order. Tick a task (\`- [x]\`) once its check passes. proposal.md says what each step is for.\n\n## 1. Build it, step by step\n\n${list.join('\n')}\n`;
  }

  /* The ticks in a tasks.md (an AI may have ticked it, edited it, added tasks) -> the steps they're about.
   * A task is a step's when its text starts with the step's name (the longest name that fits wins, so "Page"
   * doesn't take "Page basics"). If the AI reworded a task, but group 1 still has one task per step, its number
   * says which step (1.4 is the fourth). Only ticks count: a step ticked on the map stays ticked.
   *   -> { tasks: how many tasks the file has, ticked: [n of steps it ticks that aren't done], unknown: [n of
   *        steps no task was found for] } */
  const TASK = /^\s*[-*+]\s+\[([ xX])\]\s+(.*)$/;
  const plainText = (v) => line(v).replace(/[`*_]/g, '').toLowerCase();
  function ticksFrom(text, steps) {
    const list = steps || [], found = new Map();   // step n -> ticked?
    const tasks = [];
    let group = null;
    for (const l of String(text || '').split(/\r?\n/)) {
      const g = l.match(/^ {0,3}##(?!#)\s*(\d+)?/);
      if (g) { group = g[1] || null; continue; }
      const m = l.match(TASK);
      if (!m) continue;
      const id = (m[2].match(/^(\d+(?:\.\d+)+)\s+/) || [])[1] || '';
      tasks.push({ ticked: m[1] !== ' ', id, group, text: plainText(id ? m[2].slice(id.length) : m[2]) });
    }
    const byName = [...list].sort((a, b) => plainText(b.name).length - plainText(a.name).length);
    const rest = [];
    // the export's own group first, so a task the AI added elsewhere ("2.1 Page basics renders…") can't take a step
    for (const t of [...tasks.filter(x => x.group === '1'), ...tasks.filter(x => x.group !== '1')]) {
      const s = byName.find(x => { const nm = plainText(x.name); return nm && !found.has(x.n) && t.text.startsWith(nm) && !/[a-z0-9]/.test(t.text.charAt(nm.length)); });
      if (s) found.set(s.n, t.ticked); else rest.push(t);
    }
    if (tasks.filter(t => t.group === '1').length === list.length) {
      for (const t of rest) {
        const k = t.group === '1' && /^1\.(\d+)$/.test(t.id) ? +t.id.slice(2) : 0;
        const s = list[k - 1];
        if (s && !found.has(s.n)) found.set(s.n, t.ticked);
      }
    }
    return {
      tasks: tasks.length,
      ticked: list.filter(s => found.get(s.n) && !s.done).map(s => s.n),
      unknown: list.filter(s => !found.has(s.n)).map(s => s.n),
    };
  }

  function files(plan, info = {}) {
    const dir = `openspec/changes/${changeName(info.name || plan.title)}/`;
    const date = /^\d{4}-\d{2}-\d{2}$/.test(info.date || '') ? info.date : new Date().toISOString().slice(0, 10);
    return [
      { path: dir + 'proposal.md', content: proposal(plan, info) },
      { path: dir + 'tasks.md', content: tasks(plan, info) },
      { path: dir + '.openspec.yaml', content: `schema: spec-driven\ncreated: ${date}\n` },
    ];
  }

  /* A .zip of text files, stored as they are (no compression: they're small), names in UTF-8. */
  const CRC = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  })();
  function crc32(bytes) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) c = CRC[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  function zip(list, date) {
    const enc = new TextEncoder();
    const d = date && typeof date.getTime === 'function' && !isNaN(date.getTime()) ? date : new Date();
    const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    const day = (Math.max(0, d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    const parts = [], central = [];
    let offset = 0;
    const header = (size) => { const b = new Uint8Array(size); return { b, v: new DataView(b.buffer) }; };
    for (const f of list) {
      const name = enc.encode(f.path), data = enc.encode(f.content), crc = crc32(data);
      const loc = header(30);
      loc.v.setUint32(0, 0x04034b50, true); loc.v.setUint16(4, 20, true); loc.v.setUint16(6, 0x0800, true); loc.v.setUint16(8, 0, true);
      loc.v.setUint16(10, time, true); loc.v.setUint16(12, day, true); loc.v.setUint32(14, crc, true);
      loc.v.setUint32(18, data.length, true); loc.v.setUint32(22, data.length, true); loc.v.setUint16(26, name.length, true); loc.v.setUint16(28, 0, true);
      const cen = header(46);
      cen.v.setUint32(0, 0x02014b50, true); cen.v.setUint16(4, 20, true); cen.v.setUint16(6, 20, true); cen.v.setUint16(8, 0x0800, true); cen.v.setUint16(10, 0, true);
      cen.v.setUint16(12, time, true); cen.v.setUint16(14, day, true); cen.v.setUint32(16, crc, true);
      cen.v.setUint32(20, data.length, true); cen.v.setUint32(24, data.length, true); cen.v.setUint16(28, name.length, true);
      cen.v.setUint32(42, offset, true);
      parts.push(loc.b, name, data);
      central.push(cen.b, name);
      offset += 30 + name.length + data.length;
    }
    const size = central.reduce((n, b) => n + b.length, 0);
    const end = header(22);
    end.v.setUint32(0, 0x06054b50, true); end.v.setUint16(8, list.length, true); end.v.setUint16(10, list.length, true);
    end.v.setUint32(12, size, true); end.v.setUint32(16, offset, true);
    const all = [...parts, ...central, end.b];
    const out = new Uint8Array(all.reduce((n, b) => n + b.length, 0));
    let at = 0;
    for (const b of all) { out.set(b, at); at += b.length; }
    return out;
  }

  root.IntuiOpenSpec = { DEPTH, changeName, progress, proposal, tasks, ticksFrom, files, zip, crc32 };
})(typeof window !== 'undefined' ? window : globalThis);

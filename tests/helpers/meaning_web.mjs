// Does the JavaScript writer's Mechanics mean what its words say? Runs examples (tests/helpers/meaning_js.mjs)
// on a stand-in page in Node (tests/helpers/page.mjs) and checks each against what the words say, worked out by
// hand. The JavaScript writer has no rule table like Python's: its rules are written in place. So what's counted
// is its Index, the sentences and value words it offers (TEMPLATES and WORDS for Mechanics in lang/web_write.js):
// an entry counts when a line of an example that passes says it.
import { makePage } from './page.mjs';

/* Two values the same, across the page's realm and this one: same type, same items, same keys. */
export function same(a, b) {
  if (typeof a !== typeof b) return false;
  if (a === null || b === null || typeof a !== 'object') return Object.is(a, b);
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  return ka.length === kb.length && ka.every(k => same(a[k], b[k]));
}
const shown = (v) => { try { return JSON.stringify(v); } catch (_) { return String(v); } };

/* The example as a website: Structure (its page), and Mechanics: its given lines as exact JavaScript, then its
   lines, or "set result to …" for a value. */
export const mechanicsOf = (ex) => (ex.given ? ex.given.split('\n') : []).map(l => 'js: ' + l)
  .concat(ex.lines != null ? ex.lines.split('\n') : [`set result to ${ex.say}`]).join('\n') + '\n';
export const jsNameOf = (ex) => (ex.lines != null ? ex.lines.replace(/\n\s*/g, ' / ') : ex.say);

export function compileExample(WEB, ex) {
  const r = WEB.compileWebsite({ sections: [{ id: 'structure', file: 'structure', text: ex.page || '' }, { id: 'styling', file: 'styling', text: '' }, { id: 'mechanics', file: 'mechanics', text: mechanicsOf(ex) }] });
  return { html: r.results.structure.text, code: r.results.mechanics.text, errs: [...r.results.structure.info, ...r.results.mechanics.info].flatMap(i => i.errs) };
}

/* Runs one example's code on a page of its own, then what it does after ("then"), and checks it.
   ex: { say | lines, page?, given?, means?, holds?, then?, replies?, answers?, raises? } -> { ok, why } */
export async function runOne(ex, made, code = made.code) {
  const page = makePage(made.html, { replies: ex.replies, answers: ex.answers });
  page.ctx.page = page;
  let raised = null;
  try {
    page.run(code);
    await page.settle();
    await page.load();
    if (ex.then) await page.run(`(async () => {\n${ex.then}\n})()`, 'then');
    await page.settle();
  } catch (e) { raised = e; }
  raised ||= page.error || null;
  if (ex.raises) {
    const name = raised && (raised.name || raised.constructor?.name);
    return name === ex.raises || (raised && String(raised.message).includes(ex.raises)) ? { ok: true } : { ok: false, why: `should stop with ${ex.raises}, but ${raised ? `stopped with ${raised.name}: ${raised.message}` : "didn't stop"}` };
  }
  if (raised) return { ok: false, why: `stopped with ${raised.name}: ${raised.message}` };
  if (ex.means !== undefined) {
    // what the words mean, worked out on a page of its own from the given lines only
    const own = makePage(made.html);
    own.ctx.page = own;
    if (ex.given) own.run(ex.given);
    const want = own.run(`(${ex.means})`);
    let got;
    try { got = page.run('result'); } catch (e) { return { ok: false, why: `has no result: ${e.message}` }; }
    if (!same(got, want)) return { ok: false, why: `gave ${shown(got)} (${typeof got}), but the words mean ${shown(want)} (${typeof want})` };
  }
  if (ex.holds) {
    let ok;
    try { ok = page.run(`(${ex.holds})`, 'holds'); } catch (e) { return { ok: false, why: `${ex.holds}: ${e.message}` }; }
    if (!ok) return { ok: false, why: `${ex.holds} isn't true (shown: ${shown(page.shown)}, logged: ${shown(page.logged)})` };
  }
  return { ok: true };
}

export async function runJsExamples(WEB, examples) {
  const out = [];
  for (const ex of examples) {
    const made = compileExample(WEB, ex);
    if (made.errs.length) { out.push({ ex, ...made, ok: false, why: `doesn't translate: ${made.errs[0]}` }); continue; }
    out.push({ ex, ...made, ...(await runOne(ex, made)) });
  }
  return out;
}

/* ---- The Index: which of its entries an example says ---- */

const KEEP = new Set(['Math', 'JSON', 'document', 'localStorage', 'await', 'new', 'Date', 'true', 'false', 'null', 'fetch']);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/* A pattern for an Index entry, to find it in an example's lines. A sentence's ‹slots› are anything; a value
   word's names (those its code uses as names) are any one value; quoted text is any text (with {…} in it, if it
   has some). Numbers and the words themselves have to be there. */
export function entryPattern(entry) {
  if (entry.pattern) {
    const parts = entry.pattern.split(/‹[^›]*›/).map(esc);
    return new RegExp('^\\s*' + parts.join('.+?') + '\\s*$', 'i');
  }
  const [said, codeSide] = entry.words;
  const names = new Set([...codeSide.replace(/"[^"]*"|\/[^/]+\/\w*/g, '').matchAll(/(?<![.\w$])[A-Za-z_$][\w$]*/g)].map(m => m[0]).filter(n => !KEEP.has(n)));
  let src = '';
  for (const m of said.matchAll(/"[^"]*"|\/[^/\s]+\/\w*|[A-Za-z_$][\w$]*|\s+|./g)) {
    const t = m[0];
    if (/^"/.test(t)) src += /\{/.test(t) ? '"[^"]*\\{[^"]*\\}[^"]*"' : '"[^"]*"';
    else if (/^\//.test(t)) src += '/[^/\\s]+/\\w*';
    else if (/^\s+$/.test(t)) src += '\\s+';
    else if (names.has(t)) src += '[^\\s,]+';
    else src += esc(t);
  }
  return new RegExp('(?:^|\\s|\\()' + src + '(?=$|[\\s,)])', 'i');
}

/* The Mechanics entries of the Index, each with the examples (that pass) that say it. */
export function indexCoverage(WEB, results, notRun) {
  // (arrays of this realm's, so assert.deepEqual compares what's made from them)
  const entries = [...WEB.TEMPLATES].filter(t => t.sections.includes('mechanics')).map(t => ({ kind: 'statement', label: t.pattern, pattern: t.pattern }))
    .concat([...WEB.WORDS.mechanics].map(w => ({ kind: 'value', label: `${w[0]} → ${w[1]}`, words: [w[0], w[1]] })));
  for (const e of entries) {
    const re = entryPattern(e);
    e.examples = results.filter(r => r.ok).filter(r => (r.ex.lines != null ? r.ex.lines.split('\n') : [r.ex.say]).some(l => (e.pattern ? re.test(l) : re.test(' ' + l.trim())))).map(r => jsNameOf(r.ex));
    const k = Object.keys(notRun).find(k => e.label.startsWith(k));
    e.why = k ? notRun[k] : null;
  }
  return entries;
}

/* The writer's words for comparisons and maths (JS_WORDS) made wrong, one at a time: each gives the next one's
   code. Does some example notice? -> { tried, missed: [words (written as …)] } */
export async function mutateWords(WEB, examples) {
  const W = WEB.JS_WORDS, missed = [];
  let tried = 0;
  for (let i = 0; i < W.length; i++) {
    const was = W[i][1], other = W.slice(i + 1).concat(W.slice(0, i)).find(o => typeof o[1] === 'string' && o[1] !== was);
    if (typeof was !== 'string' || !other) continue;
    tried++;
    W[i][1] = other[1];
    try { if ((await runJsExamples(WEB, examples)).every(r => r.ok)) missed.push(`${W[i][0].source} (written as ${other[1].trim()})`); }
    finally { W[i][1] = was; }
  }
  return { tried, missed };
}

/* ---- The writer's rules, one by one (WEB.rules: its value words, its words for comparisons and maths, its
   statements), as for Python ---- */

/* Each rule, with the examples (that pass) that use it, or why it has none. */
export function jsRuleCoverage(WEB, results, notRun) {
  const used = new Map();
  for (const r of results.filter(r => r.ok)) for (const said of WEB.rules.trace(() => compileExample(WEB, r.ex))) (used.get(said) || used.set(said, []).get(said)).push(jsNameOf(r.ex));
  compileExample(WEB, { lines: 'zzz qqq' });   // (a line no rule reads goes past every statement, so each is noted)
  const rows = [];
  for (const r of [...WEB.rules.VALUES].filter(r => r.said)) rows.push({ kind: 'value', label: r.said });
  for (const w of [...WEB.rules.WORDS]) rows.push({ kind: 'word', label: 'word: ' + w[0].source });
  for (const said of [...WEB.rules.STATEMENTS.keys()]) rows.push({ kind: 'statement', label: said });
  for (const row of rows) { row.examples = used.get(row.label) || []; row.why = notRun[row.label] || null; }
  return rows;
}

/* How many parts a rule's pattern finds (its capture groups). OPD and OPX (one value) find none themselves. */
const partsOf = (r) => (r.re ? r.re.source : r.p ? r.p.replace(/OPX|OPD/g, 'x') : null);
const groups = (src) => (src == null ? null : new RegExp(src + '|').exec('').length - 1);

/* Each rule made to do another's work, one at a time: a value word gets the next value word's code with as many
   parts, a statement the next statement's with as many. Only the examples whose code changes run again; one whose
   code doesn't change for any example either has none (see jsRuleCoverage) or writes the same code there.
   pick(words) chooses which rules. -> { tried, missed: [rule (written as other)], same: [rule = other] } */
export async function mutateJsRules(WEB, examples, pick = () => true) {
  const before = examples.map(ex => compileExample(WEB, ex).code);
  // (a rule given another's code can make the writer itself stop: that's noticed too)
  let crashed = false;
  const changedBy = (spec) => { WEB.rules.swap(spec); crashed = false; try { return examples.filter((ex, k) => { try { return compileExample(WEB, ex).code !== before[k]; } catch (_) { crashed = true; return false; } }); } finally { WEB.rules.swap(null); } };
  const used = new Set();
  for (const ex of examples) for (const s of WEB.rules.trace(() => compileExample(WEB, ex))) used.add(s);
  compileExample(WEB, { lines: 'zzz qqq' });
  const out = { tried: 0, missed: [], same: [] };
  const tryOne = async (said, spec, other) => {
    const changed = changedBy(spec);
    if (crashed) { out.tried++; return; }
    if (!changed.length) { if (used.has(said)) out.same.push(`${said} = ${other}`); return; }
    out.tried++;
    // (wrong code can fail later, outside the example's run: that's noticed too)
    let failedLater = false;
    const later = () => { failedLater = true; };
    process.on('uncaughtException', later); process.on('unhandledRejection', later);
    WEB.rules.swap(spec);
    try {
      const ok = (await runJsExamples(WEB, changed)).every(r => r.ok);
      await new Promise(r => setTimeout(r, 0));
      if (ok && !failedLater) out.missed.push(`${said} (written as ${other})`);
    } finally { WEB.rules.swap(null); process.off('uncaughtException', later); process.off('unhandledRejection', later); }
  };
  const values = [...WEB.rules.VALUES].filter(r => r.said && r.to !== undefined);
  for (const [k, r] of values.entries()) {
    if (!pick(r.said)) continue;
    const n = groups(partsOf(r));
    const other = values.slice(k + 1).concat(values.slice(0, k)).find(o => groups(partsOf(o)) === n && o.to !== r.to && String(o.to) !== String(r.to));
    if (other) await tryOne(r.said, { from: r.said, to: other.to }, other.said);
  }
  const statements = [...WEB.rules.STATEMENTS.values()].filter(s => s.groups != null);
  for (const [k, s] of statements.entries()) {
    if (!pick(s.said)) continue;
    const other = statements.slice(k + 1).concat(statements.slice(0, k)).find(o => o.groups === s.groups);
    if (other) await tryOne(s.said, { from: s.said, statement: other.said }, other.said);
  }
  return out;
}

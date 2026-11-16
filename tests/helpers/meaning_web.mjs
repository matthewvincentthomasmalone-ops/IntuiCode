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

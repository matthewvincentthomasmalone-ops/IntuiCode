// Does each value word mean what it says? Runs examples of the Python writer's value words (EXPR_RULES in
// lang/python.js) on concrete values with the local Python, and checks each result against what the English
// says, worked out by hand (tests/helpers/meaning_python.mjs). Used by tests/meaning.test.mjs and
// tools/meaning.mjs.
import { spawnSync } from 'node:child_process';
import { PYTHON } from './engine.mjs';

/* A rule's name, from the words it was written with: "first item of x → x[0]". */
export function ruleLabel(r) {
  let s = r.re.said || r.re.source;
  s = s.replace(/\\b/g, '')
    .replace(/\(\?<?[!=](?:\\.|[^()\\])*\)/g, '')                  // look-arounds
    .replace(/\(OPD\(\?: \(\?:[^()]*\) OPD\)\*\)/g, '(OPD)')       // a sum on the left: one value
    .replace(/\(not \)\?/g, '')
    .replace(/\(\?:([^()|]*)\)\?/g, '$1')                           // optional words, said in full
    .replace(/s\?/g, 's').replace(/\w\?/g, '')                       // ("places?" is places; "an?" is a)
    .replace(/\(and\|or\|not\)/, 'and|or|not');
  for (let g = 0; g < 6 && /\(\?:/.test(s); g++) s = s.replace(/\(\?:([^()|]*)(?:\|[^()]*)?\)/g, '$1');   // first of each choice
  const [first, ...also] = s.split('|');
  let n = 0;
  const say = first.replace(/\(OPD\)/g, () => 'xyzw'[n++]).replace(/\s+/g, ' ').trim();
  const letters = ['x', 'y', 'z', 'w'];
  let py;
  if (typeof r.to === 'string') py = r.to.replace(/\$(\d)/g, (_, k) => letters[k - 1]).replace(/⟪!⟫/, 'is not').replace(/⟪⟫/, 'is');
  else if (/\(not \)\?between/.test(r.re.said || '')) py = r.to('', 'x', undefined, 'y', 'z');
  else if (/and\|or\|not/.test(r.re.source)) py = 'and';
  else py = r.to('', 'x', 'y');
  return `${say} → ${py.trim()}${also.length ? ` (also: ${also.map(a => a.replace(/\s+/g, ' ').trim()).join(', ')})` : ''}`;
}

/* The example as a Main program: its given values as exact Python lines, then "set result to …". */
export const programOf = (ex) => (ex.given ? ex.given.split('\n') : []).map(l => 'python: ' + l).concat(`set result to ${ex.say}`).join('\n') + '\n';

// Runs each job's code (runs times, random seeded 0, 1, 2 …) and checks it. The expected value is worked out
// in a namespace of its own, from the given lines only, so it never sees the translated code.
const RUNNER = String.raw`
import json, random, sys
sys.stdin.reconfigure(encoding="utf-8")
out = []
for job in json.load(sys.stdin):
    try:
        results, ns = [], {}
        for k in range(job["runs"]):
            random.seed(k)
            ns = {}
            exec(job["code"], ns)
            results.append(ns["result"])
        result = results[0]
        own = {}
        exec(job["given"], own)
        bad = None
        if job["means"] is not None:
            want = eval(job["means"], own)
            if type(result) is not type(want) or result != want:
                bad = f"gave {result!r} ({type(result).__name__}), but the words mean {want!r} ({type(want).__name__})"
        if not bad and job["holds"] and not eval(job["holds"], {**own, "result": result, "results": results}):
            bad = f"gave {result!r}, and {job['holds']} isn't true"
        for name, said in (job["after"] or {}).items():
            want = eval(said, own)
            if not bad and ns.get(name) != want:
                bad = f"left {name} as {ns.get(name)!r}, but the words mean {want!r}"
        out.append({"ok": not bad, "why": bad})
    except Exception as e:
        out.append({"ok": False, "why": f"stopped with {type(e).__name__}: {e}"})
print(json.dumps(out))
`;

/* Each example: { say, given?, means?, holds?, runs?, after? } -> { ex, ok, why, code, used: Set of rules } */
export function runExamples(L, examples) {
  const made = examples.map((ex) => {
    let r;
    const used = L.rules.trace(() => { r = L.compileProject({ sections: [{ id: 'main', file: 'main', text: programOf(ex) }] }).results.main; });
    const errs = r.info.flatMap(i => i.errs);
    return { ex, used, code: r.text, errs };
  });
  const jobs = made.map(m => ({ code: m.code, given: m.ex.given || '', means: m.ex.means ?? null, holds: m.ex.holds || null, runs: m.ex.runs || 1, after: m.ex.after || null }));
  const run = spawnSync(PYTHON, ['-c', RUNNER], { input: JSON.stringify(jobs), maxBuffer: 64 * 1024 * 1024, encoding: 'utf8' });
  if (run.status !== 0) throw new Error(run.stderr);
  const checked = JSON.parse(run.stdout);
  return made.map((m, i) => {
    if (m.errs.length) return { ...m, ok: false, why: `doesn't translate: ${m.errs[0]}` };
    return { ...m, ok: checked[i].ok, why: checked[i].why };
  });
}

/* Which rules an example ran, with a result that matched the words; and which have none. */
export function ruleCoverage(L, results, notRun) {
  const rules = [...L.rules.EXPR_RULES];   // (an array of this realm's, so assert.deepEqual compares it)
  const tested = new Map(rules.map(r => [r, []]));
  for (const res of results) if (res.ok) for (const r of res.used) tested.get(r)?.push(res.ex.say);
  const rows = rules.map(r => ({ rule: r, label: ruleLabel(r), examples: tested.get(r), why: null }));
  for (const row of rows) { const k = Object.keys(notRun).find(k => row.label.startsWith(k)); if (k) row.why = notRun[k]; }
  return rows;
}

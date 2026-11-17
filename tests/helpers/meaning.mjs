// Do the Python writer's words mean what they say? Runs examples of its value words (EXPR_RULES in
// lang/python.js) and of its statements (its RULES) with the local Python, and checks each result against what
// the English says, worked out by hand (tests/helpers/meaning_python.mjs). Used by tests/meaning.test.mjs and
// tools/meaning.mjs.
import { spawnSync } from 'node:child_process';
import { PYTHON } from './engine.mjs';

/* A value word's name, from the words it was written with: "first item of x → x[0]". */
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

/* A statement's name, from its pattern: its first wording, with x, y, z … for what it takes ("increase x by y"). */
const CHOICE = /\(\?:((?:\\.|[^()\\|])*)(?:\|(?:\\.|[^()\\])*)?\)\??/g;
export function statementLabel(r) {
  let s = r.re.source.replace(/^\^|\$$/g, '').replace(/\\b/g, '').replace(/\(\?<?[!=](?:\\.|[^()\\])*\)/g, '').replace(/\$(?=\|)/g, '');
  for (let g = 0; g < 8; g++) s = s.replace(CHOICE, '$1');   // the first of each choice; optional words said
  let n = 0;
  for (let g = 0; g < 4; g++) {
    s = s.replace(/\((?!\?)((?:\\.|[^()\\])*)\)\??/g, (m, inner) => {
      const words = inner.replace(/\\s[+*]?/g, ' ');
      if (/^[a-z ]+(?:\|[a-z |]+)*$/i.test(words)) return words.split('|')[0];   // a choice of words: the first
      return 'xyzwvu'[n++] || 'q';
    });
    for (let k = 0; k < 8; k++) s = s.replace(CHOICE, '$1');
  }
  s = s.split(/(?<!\\)\|/)[0];
  s = s.replace(/\\s[+*?]?/g, ' ').replace(/\\(.)/g, '$1').replace(/(\w)\?/g, (m, c) => (c === 's' ? 's' : '')).replace(/[?*+]/g, '').replace(/\s+/g, ' ').trim();
  return /^x y z$/.test(s) ? 'x = y, written as Python' : s;
}

/* The example as a Main program: its given values as exact Python lines, then its sentences ("lines"), or
   "set result to …" for a value. */
export const programOf = (ex) => (ex.given ? ex.given.split('\n') : []).map(l => 'python: ' + l)
  .concat(ex.lines != null ? ex.lines.split('\n') : [`set result to ${ex.say}`]).join('\n') + '\n';
export const nameOf = (ex) => (ex.lines != null ? ex.lines.replace(/\n\s*/g, ' / ') : ex.say);

// Runs each job's code (runs times, random seeded 0, 1, 2 …) and checks it. What the words mean is worked out
// in a namespace of its own, from the given lines only, so it never sees the translated code. Shown text is
// caught, "ask" gets the job's answers, "wait" is noted instead of waited, and the folder is put back after.
const RUNNER = String.raw`
import builtins, contextlib, io, json, os, random, sys, tempfile, time
sys.stdin.reconfigure(encoding="utf-8")
home, real_sleep, real_input = os.getcwd(), time.sleep, builtins.input
def same(a, b):
    return type(a) is type(b) and a == b
STEPS = 100000   # lines of its own an example may run: one that runs more has a loop that doesn't end
class TooLong(Exception):
    pass
def limited():
    steps = [0]
    def trace(frame, event, arg):
        if frame.f_code.co_filename != "<example>":
            return None   # (Python's own modules aren't counted, or traced)
        if event == "line":
            steps[0] += 1
            if steps[0] > STEPS:
                raise TooLong(f"ran more than {STEPS} lines: a loop that doesn't end?")
        return trace
    return trace
def run(job):
    results = []
    for k in range(job["runs"]):
        random.seed(k)
        slept, answers, out = [], list(job["input"] or []), io.StringIO()
        def ask(prompt=""):
            out.write(str(prompt))
            if not answers:
                raise EOFError("the example has no answer left for this question")
            return answers.pop(0)
        time.sleep, builtins.input = slept.append, ask
        ns, raised = {"__name__": "__main__"}, None
        # (each run in a folder of its own, so a file it writes never lands in the project, even when a wrong rule
        # skips the example's own move to one)
        os.chdir(tempfile.mkdtemp())
        try:
            with contextlib.redirect_stdout(out):
                sys.settrace(limited())
                try:
                    exec(compile(job["code"], "<example>", "exec"), ns)
                finally:
                    sys.settrace(None)
        except BaseException as e:
            raised = e
        finally:
            time.sleep, builtins.input = real_sleep, real_input
            os.chdir(home)
        results.append(ns.get("result"))
    return ns, results, out.getvalue(), slept, raised
out = []
for job in json.load(sys.stdin):
    try:
        ns, results, shown, slept, raised = run(job)
        result = results[0]
        own = {"__name__": "__main__"}
        os.chdir(tempfile.mkdtemp())
        exec(job["given"], own)
        os.chdir(home)
        bad = None
        if job["raises"]:
            if type(raised).__name__ != job["raises"]:
                bad = f"should stop with {job['raises']}, but " + (f"stopped with {type(raised).__name__}" if raised else "didn't stop")
        elif raised is not None:
            bad = f"stopped with {type(raised).__name__}: {raised}"
        if not bad and job["means"] is not None:
            want = eval(job["means"], own)
            if not same(result, want):
                bad = f"gave {result!r} ({type(result).__name__}), but the words mean {want!r} ({type(want).__name__})"
        for name, said in (job["names"] or {}).items():
            want = eval(said, own)
            if not bad and not same(ns.get(name), want):
                bad = f"left {name} as {ns.get(name)!r}, but the words mean {want!r}"
        if not bad and job["prints"] is not None and shown != job["prints"]:
            bad = f"showed {shown!r}, but the words mean {job['prints']!r}"
        if not bad and job["holds"] and not eval(job["holds"], {**own, **ns, "result": result, "results": results, "shown": shown, "slept": slept}):
            bad = f"{job['holds']} isn't true (it showed {shown!r}, waited {slept!r})"
        out.append({"ok": not bad, "why": bad})
    except Exception as e:
        out.append({"ok": False, "why": f"the check stopped with {type(e).__name__}: {e}"})
print(json.dumps(out))
`;

/* Each example: a value { say, … } or statements { lines, … }, with given?, means?, names?, prints?, input?,
   raises?, holds?, runs? -> { ex, ok, why, code, used: Set of rules } */
export function runExamples(L, examples) {
  const made = examples.map((ex) => {
    let r;
    const used = L.rules.trace(() => { r = L.compileProject({ sections: [{ id: 'main', file: 'main', text: programOf(ex) }] }).results.main; });
    const errs = r.info.flatMap(i => i.errs);
    return { ex, used, code: r.text, errs };
  });
  const jobs = made.map(m => ({
    code: m.code, given: m.ex.given || '', means: m.ex.means ?? null, names: { ...m.ex.after, ...m.ex.names }, prints: m.ex.prints ?? null,
    input: m.ex.input || null, raises: m.ex.raises || null, holds: m.ex.holds || null, runs: m.ex.runs || 1,
  }));
  const run = spawnSync(PYTHON, ['-c', RUNNER], { input: JSON.stringify(jobs), maxBuffer: 64 * 1024 * 1024, encoding: 'utf8' });
  if (run.status !== 0) throw new Error(run.stderr);
  const checked = JSON.parse(run.stdout);
  return made.map((m, i) => {
    if (m.errs.length) return { ...m, ok: false, why: `doesn't translate: ${m.errs[0]}` };
    return { ...m, ok: checked[i].ok, why: checked[i].why };
  });
}

/* Each rule, value words then statements, with the examples that ran it and matched the words, or why it has none. */
export function ruleCoverage(L, results, notRun) {
  const rows = [...L.rules.EXPR_RULES].map(r => ({ rule: r, kind: 'value', label: ruleLabel(r) }))
    .concat([...L.rules.STATEMENTS].map(r => ({ rule: r, kind: 'statement', label: statementLabel(r) })));
  const tested = new Map(rows.map(row => [row.rule, []]));
  for (const res of results) if (res.ok) for (const r of res.used) tested.get(r)?.push(nameOf(res.ex));
  for (const row of rows) {
    row.examples = tested.get(row.rule);
    const k = Object.keys(notRun).find(k => row.label.startsWith(k));
    row.why = k ? notRun[k] : null;
  }
  return rows;   // (an array of this realm's, so assert.deepEqual compares what's made from it)
}

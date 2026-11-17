// Do two of a writer's rules read the same sentence? Each writer tries its statements in order and the first that
// matches wins, so a sentence two rules match is read by the first one. That's often on purpose (a narrower
// wording before a wider one: "take the last item out of xs" before "take x out of y"), but a new pair is worth a
// look: it's how rules come to clash as they grow (ROADMAP.md, Known risks 1). The sentences checked are every
// statement example's lines, and the sentences the reader makes for the corpora.
// Used by tests/collisions.test.mjs and tools/meaning.mjs.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { ROOT, toSentences, pyFiles } from './engine.mjs';
import { statementLabel } from './meaning.mjs';
import { STATEMENTS as PY_STATEMENTS } from './meaning_python.mjs';
import { JS_STATEMENTS } from './meaning_js.mjs';

const clean = (l) => l.trim().replace(/[.:]$/, '');
const skip = (l) => !l || /^(?:python|js|javascript|raw|c\+\+|html|note|comment)\s*:/i.test(l);

/* rules: [{ label, re }] in the order they're tried; lines: sentences. -> Map("winner ⟂ other" -> [lines]) */
export function overlaps(rules, lines) {
  const pairs = new Map();
  for (const l of lines) {
    if (skip(l)) continue;
    const hit = rules.filter(r => r.re && r.re.test(l));
    for (const other of hit.slice(1)) {
      const k = `${hit[0].label} ⟂ ${other.label}`;
      if (!pairs.has(k)) pairs.set(k, []);
      if (!pairs.get(k).includes(l)) pairs.get(k).push(l);
    }
  }
  return pairs;
}

/* The Python writer's statements, and the sentences to try them on. */
export function pythonOverlaps(L) {
  const lines = new Set();
  for (const ex of PY_STATEMENTS) for (const l of ex.lines.split('\n')) lines.add(clean(l));
  const sources = ['samples', 'tests/corpus', 'tests/heldout'].flatMap(d => pyFiles(path.join(ROOT, d))).map(f => readFileSync(f, 'utf8'));
  for (const text of toSentences(sources)) for (const l of String(text).split('\n')) lines.add(clean(l));
  return overlaps([...L.rules.STATEMENTS].map(r => ({ label: statementLabel(r), re: r.re })), lines);
}

/* The JavaScript writer's statements (WEB.rules.STATEMENTS, filled in once the writer has run), and the sentences
   to try them on: the examples' lines, and what the reader says for tests/corpus_web's scripts. */
export function jsOverlaps(WEB, convert) {
  const lines = new Set();
  for (const ex of JS_STATEMENTS) if (ex.lines != null) for (const l of ex.lines.split('\n')) lines.add(clean(l));
  const dir = path.join(ROOT, 'tests/corpus_web');
  for (const f of readdirSync(dir).filter(n => /\.js$/.test(n) && statSync(path.join(dir, n)).isFile())) {
    const r = convert('js', readFileSync(path.join(dir, f), 'utf8'));
    if (r.ok) for (const l of r.text.split('\n')) lines.add(clean(l));
  }
  WEB.compileWebsite({ sections: [{ id: 'm', file: 'mechanics', text: 'zzz qqq\n' }] });   // (every rule is noted once the writer has run)
  return overlaps([...WEB.rules.STATEMENTS.values()].map(r => ({ label: r.said, re: r.re })), lines);
}

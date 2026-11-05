// The Library (lang/library.js and its packs in lang/library/): every type and part is well formed, every
// sentence variant translates cleanly into code that parses, every code variant parses with its grammar,
// and the audio, maths and data parts give the right numbers when the generated Python and JavaScript run.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { loadEngine, loadLibrary, loadTreeSitter, PYTHON, ROOT, LIBRARY_PACKS } from './helpers/engine.mjs';

const { L, WEB, CPP } = loadEngine();
const { LIB, LANGS, BUILDER, packs } = loadLibrary();
const cat = LIB.catalog();
const TS = await loadTreeSitter();
const plain = (x) => JSON.parse(JSON.stringify(x));
const base = (file) => path.basename(file).replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9_]/g, '_');

/* ------------------------------------------------------------------ the catalog itself */

test('library: every pack entry parses and the catalog has no errors', () => {
  assert.deepEqual(plain(cat.errors), []);
  for (const text of packs) assert.deepEqual(plain(LIB.parseEntry(text).problems), [], text.split('\n')[0]);
});

test('library: at least 30 project types and 80 parts, with unique ids', () => {
  const entries = packs.map(t => LIB.parseEntry(t));
  const ids = (kind) => entries.filter(e => e.kind === kind).map(e => e.id);
  assert.ok(cat.types.length >= 30, `only ${cat.types.length} types`);
  assert.ok(cat.parts.length >= 80, `only ${cat.parts.length} parts`);
  for (const kind of ['type', 'part']) {
    const all = ids(kind), seen = new Set();
    for (const id of all) { assert.ok(!seen.has(id), `two ${kind}s are called ${id}`); seen.add(id); }
  }
  assert.equal(cat.types.length, ids('type').length);
  assert.equal(cat.parts.length, ids('part').length);
});

test('library: types and parts point at each other, and every part is in a type', () => {
  for (const t of cat.types) {
    assert.ok(t.parts.length, `${t.id} has no parts`);
    for (const id of t.partIds) assert.ok(LIB.part(id), `${t.id} lists ${id}, which doesn't exist`);
    for (const p of LIB.partsFor(t.id)) assert.ok(p.types.includes(t.id));
  }
  for (const p of cat.parts) {
    assert.ok(p.types.length, `${p.id} is in no type`);
    for (const id of p.typeIds) assert.ok(LIB.type(id), `${p.id} names a type ${id} that doesn't exist`);
    assert.deepEqual(LIB.typesFor(p.id).map(t => t.id), p.types);
  }
});

test('library: languages, groups, platforms, headings, templates and sources are all known', () => {
  const groups = new Set(LIB.GROUPS.map(g => g.id));
  assert.ok(groups.has('integration') && LIB.GROUPS.find(g => g.id === 'integration').title === 'Coding integration');
  for (const t of cat.types) {
    assert.ok(t.heading && cat.headings.includes(t.heading), t.id);
    for (const p of t.platforms) assert.ok(LIB.PLATFORMS[p], `${t.id}: platform ${p}`);
    assert.ok(t.languages.length, t.id);
    for (const l of t.languages) assert.ok(LANGS.byId(l.lang) && l.why, `${t.id}: language ${l.said}`);
    assert.ok(t.learnFrom.length >= 2, `${t.id} needs at least two projects to learn from`);
    for (const l of t.learnFrom) {
      assert.ok(LANGS.byId(l.lang), `${t.id}: ${l.name} is in ${l.said}`);
      assert.ok(l.licence && l.what && /^https?:\/\//.test(l.url), `${t.id}: ${l.name}`);
    }
    for (const k of t.templates) assert.ok(BUILDER.library.kits[k], `${t.id}: template ${k} isn't a kit`);
  }
  for (const p of cat.parts) {
    assert.ok(groups.has(p.group), `${p.id}: group ${p.group}`);
    assert.ok(p.about && p.summary, p.id);
    for (const s of p.sources) assert.ok(s.name && s.what && (!s.url || /^https?:\/\//.test(s.url)), `${p.id}: source ${s.name}`);
    assert.ok(p.variants.length, p.id);
    for (const v of p.variants) {
      const lang = LANGS.byId(v.lang);
      assert.ok(lang, `${p.id}: ${v.lang} isn't in lang/languages.js`);
      assert.equal(v.write, lang.write, `${p.id}: ${v.file}`);
      assert.ok(v.file && v.text.trim(), `${p.id}: ${v.lang}`);
    }
    if (p.group === 'integration') assert.ok(new Set(p.variants.map(v => v.file)).size >= 2, `${p.id} gives only one side`);
  }
  const audio = cat.parts.filter(p => p.group === 'audio').length;
  assert.ok(audio >= 15, `only ${audio} audio parts`);
});

test('library: the API', () => {
  assert.equal(LIB.part('gain-db').title, 'Gain in decibels');
  assert.ok(LIB.partsFor('daw').some(p => p.id === 'biquad'));
  assert.equal(LIB.partsFor('no-such-type').length, 0);
  const v = LIB.forLanguage('gain-db', 'cpp');
  assert.equal(v.write, 'sentences');
  assert.match(v.file, /\.cpp$/);
  assert.equal(LIB.forLanguage('gain-db', 'zig'), null);
  assert.deepEqual(plain(LIB.variants('py-c-ctypes').map(x => x.lang)), ['cpp', 'bash', 'python']);
  // problems are listed, not thrown
  const broken = LIB.catalogFrom(['type: x\ntitle: X', 'part: y\ngroup: nowhere\n== klingon y.kl\nqapla', 'nonsense']);
  assert.ok(broken.errors.some(e => /heading/.test(e)) && broken.errors.some(e => /isn't a group/.test(e)) && broken.errors.some(e => /klingon/.test(e)) && broken.errors.some(e => /first line says/.test(e)));
});

test('library: the format is documented, and no pack interpolates ${…}', () => {
  const doc = readFileSync(path.join(ROOT, 'lang/library/README.md'), 'utf8');
  for (const word of ['type:', 'part:', 'language:', 'learn from:', 'source:', '== ']) assert.ok(doc.includes(word), word);
  for (const f of LIBRARY_PACKS) assert.doesNotMatch(readFileSync(path.join(ROOT, f), 'utf8').replace(/\\\$\{/g, ''), /\$\{/, f);
});

/* ------------------------------------------------------------------ translating the sentence variants */

/* Every sentence variant, translated: [{ part, v, res, code }]. JavaScript gets the part's HTML as its page
 * (so it can use the elements named there) and the part's CSS sees the same page. */
function translateAll() {
  const out = [];
  for (const p of cat.parts) {
    const html = p.variants.filter(v => v.lang === 'html').map(v => v.text).join('\n');
    const css = p.variants.filter(v => v.lang === 'css').map(v => v.text).join('\n');
    for (const v of p.variants) {
      if (v.write !== 'sentences') continue;
      let res;
      if (v.lang === 'python') res = L.compileProject({ sections: [{ id: 'v', file: base(v.file), text: v.text }] }).results.v;
      else if (v.lang === 'cpp') res = CPP.compileCppProject({ sections: [{ id: 'v', file: 'program', text: v.text }] }).results.v;
      else if (v.lang === 'arduino') res = CPP.compileCppProject({ kind: 'arduino', sections: [{ id: 'v', file: 'sketch', text: v.text }] }).results.v;
      else {
        const r = WEB.compileWebsite({ sections: [
          { id: 'structure', file: 'structure', text: v.lang === 'html' ? v.text : html },
          { id: 'styling', file: 'styling', text: v.lang === 'css' ? v.text : css },
          { id: 'mechanics', file: 'mechanics', text: v.lang === 'js' ? v.text : '' }] });
        res = r.results[{ html: 'structure', css: 'styling', js: 'mechanics' }[v.lang]];
      }
      out.push({ part: p, v, res, code: res.text });
    }
  }
  return out;
}
const translated = translateAll();
const codeOf = (partId, file) => translated.find(t => t.part.id === partId && (!file || t.v.file === file));

test('library: every sentence variant translates with no errors or warnings', () => {
  const problems = [];
  for (const { part, v, res } of translated) {
    const lines = v.text.split('\n');
    res.info.forEach((inf, i) => { for (const e of [...inf.errs, ...inf.warns]) problems.push(`${part.id} ${v.file} line ${i + 1} "${lines[i].trim()}": ${e}`); });
  }
  assert.deepEqual(problems, []);
  assert.ok(translated.length >= 150, `only ${translated.length} sentence variants`);
});

/* A tree's first ERROR or MISSING node, or null. */
function firstError(node) {
  if (node.type === 'ERROR' || node.isMissing()) return node;
  if (!node.hasError()) return null;
  for (const c of node.children) { const e = firstError(c); if (e) return e; }
  return node;
}
async function assertParses(grammar, source, label) {
  const tree = await TS.parse(grammar, source);
  const bad = firstError(tree.rootNode);
  assert.equal(bad, null, bad && `${label}: ${grammar} can't read line ${bad.startPosition.row + 1}: ${source.split('\n')[bad.startPosition.row]}\n${source}`);
}

test('library: the generated HTML, CSS, JavaScript, C++ and Arduino code parses', async () => {
  const grammar = { html: 'html', css: 'css', js: 'javascript', cpp: 'cpp', arduino: 'cpp' };
  for (const { part, v, code } of translated) {
    if (v.lang === 'python') continue;
    await assertParses(grammar[v.lang], code, `${part.id} ${v.file}`);
    if (v.lang === 'js') assert.doesNotThrow(() => new vm.Script(code), `${part.id} ${v.file}`);
  }
});

test('library: the generated Python is valid Python', () => {
  const sources = translated.filter(t => t.v.lang === 'python').map(t => [`${t.part.id} ${t.v.file}`, t.code]);
  const out = execFileSync(PYTHON, ['-c', 'import ast, json, sys\nsys.stdin.reconfigure(encoding="utf-8")\nbad = []\nfor name, src in json.load(sys.stdin):\n    try:\n        ast.parse(src)\n    except SyntaxError as e:\n        bad.append(f"{name} line {e.lineno}: {e.msg}")\nprint(json.dumps(bad))'], { input: JSON.stringify(sources), maxBuffer: 64 * 1024 * 1024 });
  assert.deepEqual(JSON.parse(out.toString()), []);
});

/* C++ with only the standard library is compiled too, where g++ is installed (it is on GitHub's runners). */
const hasGpp = spawnSync('g++', ['--version']).status === 0;
const STD_HEADERS = new Set(['iostream', 'string', 'vector', 'random', 'sstream', 'cstdlib', 'cmath', 'numbers', 'atomic', 'array', 'cstddef', 'algorithm', 'chrono', 'map', 'utility', 'fstream']);
test('library: C++ variants that use only the standard library compile with g++', { skip: !hasGpp && 'g++ is not installed' }, () => {
  for (const { part, v, code } of translated) {
    if (v.lang !== 'cpp') continue;
    const headers = [...code.matchAll(/^#include <([^>]+)>/gm)].map(m => m[1]);
    if (!headers.every(h => STD_HEADERS.has(h))) continue;
    const r = spawnSync('g++', ['-std=c++20', '-fsyntax-only', '-Wall', '-x', 'c++', '-'], { input: code });
    assert.equal(r.status, 0, `${part.id} ${v.file}: g++ rejected it\n${r.stderr}\n${code}`);
  }
});

/* ------------------------------------------------------------------ the code and text variants */

test('library: every code variant parses with its tree-sitter grammar', async () => {
  let n = 0;
  for (const p of cat.parts) for (const v of p.variants) {
    if (v.write === 'sentences') continue;
    const lang = LANGS.byId(v.lang);
    if (v.lang === 'json') { assert.doesNotThrow(() => JSON.parse(v.text), `${p.id} ${v.file}`); continue; }
    if (!lang.grammar) continue;
    await assertParses(lang.grammar, v.text + '\n', `${p.id} ${v.file}`);
    n++;
  }
  assert.ok(n >= 15, `only ${n} code variants were parsed`);
});

test('library: the SQL runs in SQLite', () => {
  const sql = cat.parts.flatMap(p => p.variants.filter(v => v.lang === 'sql').map(v => [`${p.id} ${v.file}`, v.text]));
  assert.ok(sql.length >= 2);
  const out = execFileSync(PYTHON, ['-c', 'import json, sqlite3, sys\nsys.stdin.reconfigure(encoding="utf-8")\nbad = []\nfor name, text in json.load(sys.stdin):\n    try:\n        sqlite3.connect(":memory:").executescript(text)\n    except sqlite3.Error as e:\n        bad.append(f"{name}: {e}")\nprint(json.dumps(bad))'], { input: JSON.stringify(sql) });
  assert.deepEqual(JSON.parse(out.toString()), []);
});

/* ------------------------------------------------------------------ the numbers: generated Python */

/* Checks run after a part's generated Python (all its Python files, in one namespace). Files of other kinds
 * in the part (schema.sql, settings.json) sit next to it, as __file__'s neighbours. */
const PY_CHECKS = {
  'gain-db': String.raw`
assert abs(gain_from_db(-6) - 0.501) < 0.001
assert gain_from_db(0) == 1
assert abs(db_from_gain(0.5) - -6.0206) < 0.001
assert db_from_gain(0) == -120.0
assert abs(apply_gain([1.0, -0.5], -20)[0] - 0.1) < 1e-12`,
  'pan-law': String.raw`
l, r = constant_power_pan(0)
assert abs(l - 0.70711) < 0.0001 and abs(r - 0.70711) < 0.0001
for p in [-1, -0.5, 0, 0.3, 1]:
    l, r = constant_power_pan(p)
    assert abs(l * l + r * r - 1) < 1e-12
assert abs(constant_power_pan(-1)[1]) < 1e-12 and abs(constant_power_pan(1)[0]) < 1e-12
assert linear_pan(0) == (0.5, 0.5)
left, right = pan_mono([1.0], 1)
assert abs(left[0]) < 1e-12 and abs(right[0] - 1) < 1e-12`,
  'mix-bus': String.raw`
mix, overs = mix_tracks([[1.0, 1.0], [1.0]], [0, 0], 0)
assert mix == [2.0, 1.0] and overs == 1
mix, overs = mix_tracks([[1.0, 1.0], [1.0]], [0, 0], -6.0206)
assert abs(mix[0] - 1.0) < 0.001 and overs == 0`,
  'peak-meter': String.raw`
m = PeakMeter(48000, fall_db_per_second=20.0, hold_seconds=1.0)
level, peak = m.update([0.5] * 480)
assert abs(level - -6.0206) < 0.01 and peak == level
for _ in range(50):
    level, peak = m.update([0.0] * 480)
assert abs(level - -16.0206) < 0.05, level
assert abs(peak - -6.0206) < 0.01, peak
for _ in range(100):
    level, peak = m.update([0.0] * 480)
assert peak < -6.5`,
  'rms-meter': String.raw`
m = RmsMeter(48000, 0.3)
db = m.update([math.sin(2 * math.pi * 1000 * n / 48000) for n in range(48000 * 3)])
assert abs(db - -3.0103) < 0.05, db`,
  'loudness-meter': String.raw`
tone = [math.sin(2 * math.pi * 997 * n / 48000) for n in range(48000)]
lufs = momentary_loudness(tone)
assert abs(lufs - -3.01) < 0.05, lufs
assert abs(momentary_loudness([s * 0.1 for s in tone]) - -23.01) < 0.05`,
  'biquad': String.raw`
import cmath
def response(c, f, fs=48000):
    z = cmath.exp(-1j * 2 * math.pi * f / fs)
    return abs((c["b0"] + c["b1"] * z + c["b2"] * z * z) / (1 + c["a1"] * z + c["a2"] * z * z))
c = biquad_coefficients("low-pass", 1000, 0.7071, 48000)
assert abs(response(c, 0) - 1) < 1e-9, "a low-pass passes DC at gain 1"
assert response(c, 24000) < 1e-9, "and cuts at Nyquist"
assert abs(20 * math.log10(response(c, 1000)) - -3.01) < 0.01, "-3 dB at its cutoff with Q 0.7071"
assert abs(run_biquad([1.0] * 4800, c)[-1] - 1) < 1e-6
assert max(abs(v) for v in run_biquad([(-1.0) ** n for n in range(4800)], c)[-100:]) < 1e-3
h = biquad_coefficients("high-pass", 1000, 0.7071, 48000)
assert response(h, 0) < 1e-9 and abs(response(h, 24000) - 1) < 1e-9
p = biquad_coefficients("peaking", 1000, 1.0, 48000, 6.0)
assert abs(20 * math.log10(response(p, 1000)) - 6) < 0.01 and abs(20 * math.log10(response(p, 10))) < 0.01
ls = biquad_coefficients("low shelf", 200, 0.7071, 48000, 6.0)
assert abs(20 * math.log10(response(ls, 1)) - 6) < 0.01 and abs(20 * math.log10(response(ls, 24000))) < 0.01
hs = biquad_coefficients("high shelf", 5000, 0.7071, 48000, -6.0)
assert abs(20 * math.log10(response(hs, 24000)) + 6) < 0.01 and abs(20 * math.log10(response(hs, 1))) < 0.01
try:
    biquad_coefficients("band", 1000, 1, 48000)
    raise AssertionError("an unknown kind must fail")
except ValueError:
    pass`,
  'smoother': String.raw`
s = Smoother(48000, time=0.01, start=0.0)
s.target = 1.0
values = [s.next_value() for _ in range(480)]
assert abs(values[-1] - (1 - math.exp(-1))) < 1e-9
assert all(b > a for a, b in zip(values, values[1:]))`,
  'compressor': String.raw`
assert gain_reduction_db(-30, -18, 4, 6) == 0.0
assert abs(gain_reduction_db(-6, -18, 4, 0) - -9.0) < 1e-9
assert abs(gain_reduction_db(-18, -18, 4, 6) - (0.25 - 1) * 9 / 12) < 1e-9
for edge in (-21, -15):
    assert abs(gain_reduction_db(edge - 1e-6, -18, 4, 6) - gain_reduction_db(edge + 1e-6, -18, 4, 6)) < 1e-4
out = compress([1.0] * 48000, 48000, threshold_db=-18, ratio=4, knee_db=0, attack=0.001, release=0.1)
assert abs(20 * math.log10(out[-1]) - -13.5) < 0.05, out[-1]`,
  'limiter': String.raw`
y = limit([0.5, 1.2, -1.5, 0.3] + [0.9] * 1000, 48000, ceiling_db=-1.0)
assert max(abs(v) for v in y) <= 10 ** (-1 / 20) + 1e-12
assert y[0] == 0.5`,
  'gate': String.raw`
y = gate([0.5] * 4800 + [0.001] * 48000, 48000)
assert abs(y[4799] - 0.5) < 0.001 and abs(y[-1]) < 1e-9`,
  'delay-line': String.raw`
y = echo([1.0] + [0.0] * 999, 1000, delay_seconds=0.1, feedback=0.5, mix=1.0)
assert abs(y[100] - 1.0) < 1e-12 and abs(y[200] - 0.5) < 1e-12 and abs(y[300] - 0.25) < 1e-12 and y[50] == 0`,
  'crossfade': String.raw`
for p in [0, 0.25, 0.5, 1]:
    a, b = equal_power_gains(p)
    assert abs(a * a + b * b - 1) < 1e-12
y = crossfade([1.0] * 11, [1.0] * 11)
assert abs(y[0] - 1) < 1e-12 and abs(y[-1] - 1) < 1e-12 and abs(y[5] - 2 ** 0.5) < 1e-9`,
  'waveshaper': String.raw`
assert soft_clip(2) == 1.0 and soft_clip(-3) == -1.0 and soft_clip(0) == 0
assert abs(soft_clip(1 - 1e-9) - 1) < 1e-6 and abs(soft_clip(0.01) - 0.015) < 1e-4
assert hard_clip(1.7) == 1.0 and hard_clip(-0.2) == -0.2
y = saturate([0.001, 1.0], drive_db=0.0)
assert abs(y[0] - 0.001) < 1e-6 and abs(y[1] - math.tanh(1)) < 1e-12`,
  'dc-blocker': String.raw`
y = block_dc([0.5] * 20000)
assert abs(y[0] - 0.5) < 1e-12 and abs(y[-1]) < 1e-9`,
  'wav-file': String.raw`
import os, tempfile
path = os.path.join(tempfile.mkdtemp(), "t.wav")
save_wav([0.0, 0.5, -0.5, 1.5], path, 44100)
samples, rate = load_wav(path)
assert rate == 44100 and len(samples) == 4 and abs(samples[1] - 0.5) < 0.001 and samples[3] == 32767 / 32768`,
  'midi-note-frequency': String.raw`
assert note_to_frequency(69) == 440.0 and abs(note_to_frequency(60) - 261.6256) < 0.0001 and note_to_frequency(81) == 880
assert abs(frequency_to_note(261.6256) - 60) < 0.0001
assert abs(cents_off(445) - 19.56) < 0.01`,
  'note-names': String.raw`
assert note_name(60) == "C4" and note_name(69) == "A4" and note_name(0) == "C-1"
assert note_number("C4") == 60 and note_number("F#3") == 54 and note_number("A-1") == 9`,
  'scales-chords': String.raw`
assert scale_notes(60) == [60, 62, 64, 65, 67, 69, 71]
assert chord_notes(57, "minor") == [57, 60, 64]`,
  'tempo-grid': String.raw`
assert samples_per_beat(120, 48000) == 24000
assert bars_beats_ticks(0, 120, 48000) == (1, 1, 0)
assert bars_beats_ticks(24000 * 5 + 12000, 120, 48000) == (2, 2, 480)`,
  'adsr': String.raw`
e = Envelope(1000, attack=0.01, decay=0.01, sustain=0.5, release=0.01)
e.note_on()
levels = [e.next_level() for _ in range(40)]
assert abs(max(levels) - 1.0) < 1e-9 and abs(levels[-1] - 0.5) < 1e-9 and e.stage == "sustain"
e.note_off()
tail = [e.next_level() for _ in range(20)]
assert tail[-1] == 0.0 and e.stage == "idle"`,
  'oscillator': String.raw`
s = oscillator("sine", 1000, 0.01, 48000)
assert len(s) == 480 and abs(s[12] - 1) < 1e-9
w = oscillator("square", 1000, 0.002, 48000)
assert w[0] == 1.0 and w[30] == -1.0
t = oscillator("triangle", 1000, 0.001, 48000)
assert abs(t[0] + 1) < 1e-9 and abs(t[24] - 1) < 1e-9
assert abs(oscillator("saw", 1000, 0.001, 48000)[0] + 1) < 1e-9`,
  'midi-messages': String.raw`
assert note_on(0, 60, 100) == [0x90, 60, 100] and note_on(15, 60, 100)[0] == 0x9F and note_off(1, 60) == [0x81, 60, 0]
assert describe([0x90, 60, 100]) == "note on 60, velocity 100, channel 1"
assert describe([0x90, 60, 0]) == "note off 60, channel 1"
assert describe([0xB1, 7, 127]) == "control 7 = 127, channel 2"`,
  'colour-codes': String.raw`
assert hex_to_rgb("#4f7cff") == (79, 124, 255) and rgb_to_hex(79, 124, 255) == "#4f7cff"
assert rgb_to_hsl(255, 0, 0) == (0, 100, 50)`,
  'polygon-points': String.raw`
p = polygon_points(4, 0, 0, 1)
assert len(p) == 4 and abs(p[0][0]) < 1e-12 and abs(p[0][1] + 1) < 1e-12
s = star_points(5, 0, 0, 2, 1)
assert len(s) == 10 and abs(math.hypot(*s[0]) - 2) < 1e-12 and abs(math.hypot(*s[1]) - 1) < 1e-12`,
  'rotate-point': String.raw`
x, y = rotate_point(2, 1, 1, 1, 90)
assert abs(x - 1) < 1e-12 and abs(y - 2) < 1e-12`,
  'box-collision': String.raw`
assert boxes_overlap(0, 0, 10, 10, 5, 5, 10, 10)
assert not boxes_overlap(0, 0, 10, 10, 10, 0, 5, 5)`,
  'circle-collision': String.raw`
assert circles_overlap(0, 0, 1, 1.5, 0, 1) and not circles_overlap(0, 0, 1, 3, 0, 1)`,
  'gravity-jump': String.raw`
b = {"y": 0.0, "speed": 0.0, "standing": False}
for _ in range(600):
    step_body(b, 1 / 60, 100)
assert b["y"] == 100 and b["standing"]
jump(b)
assert b["speed"] == JUMP_SPEED and not b["standing"]
step_body(b, 1 / 60, 100)
assert b["y"] < 100`,
  'sprite-animation': String.raw`
assert frame_at(0, 8, 12) == 0 and frame_at(1, 8, 12) == 4 and frame_area(3, 32, 32) == (96, 0, 32, 32)`,
  'tile-map': String.raw`
assert is_solid(0, 0) and not is_solid(20, 20) and is_solid(-5, 20) and is_solid(1000, 20) and is_solid(3 * 16 + 1, 2 * 16 + 1)`,
  'camera-follow': String.raw`
x = 0
for _ in range(600):
    x = follow(x, 500, 1 / 60, 200, 1000)
assert abs(x - 400) < 0.01
assert follow(0, 0, 1 / 60, 200, 1000) == 0 and follow(900, 2000, 1, 200, 1000) == 800`,
  'game-states': String.raw`
assert next_state("menu", "start") == "playing" and next_state("menu", "pause") == "menu" and next_state("game over", "restart") == "menu"`,
  'high-score': String.raw`
import os, tempfile
p = os.path.join(tempfile.mkdtemp(), "s.json")
assert best_score(p) == 0 and record_score(10, p) == 10 and record_score(5, p) == 10 and best_score(p) == 10
open(p, "w").write("not json")
assert best_score(p) == 0`,
  'weighted-random': String.raw`
import random
random.seed(1)
picks = [pick_weighted(["a", "b"], [3, 1]) for _ in range(4000)]
assert 0.72 < picks.count("a") / 4000 < 0.78
assert pick_weighted(["only"], [1]) == "only"`,
  'easing': String.raw`
assert smoothstep(0) == 0 and smoothstep(1) == 1 and smoothstep(0.5) == 0.5
assert tween(10, 20, 2) == 20 and tween(10, 20, 0.5) == 15
assert ease_in(0.5) == 0.25 and ease_out(0.5) == 0.75`,
  'clamp-lerp-map': String.raw`
assert clamp(5, 0, 3) == 3 and lerp(0, 10, 0.25) == 2.5 and map_range(5, 0, 10, 100, 200) == 150`,
  'vectors-2d': String.raw`
assert vector_length(3, 4) == 5 and normalised(3, 4) == (0.6, 0.8) and normalised(0, 0) == (0.0, 0.0) and dot(1, 0, 0, 1) == 0`,
  'moving-average': String.raw`
assert moving_average([1, 2, 3, 4], 2) == [1.0, 1.5, 2.5, 3.5]
assert exponential_average([0, 10, 10, 10], 0.5) == [0, 5.0, 7.5, 8.75]`,
  'statistics': String.raw`
import statistics
data = [2, 4, 4, 4, 5, 5, 7, 9]
assert mean(data) == 5 and median(data) == 4.5 and median([3, 1, 2]) == 2
assert abs(standard_deviation(data) - statistics.stdev(data)) < 1e-12`,
  'angles': String.raw`
assert abs(angle_to(0, 0, 0, 1) - 90) < 1e-12 and turn_by(350, 10) == 20 and turn_by(10, 350) == -20`,
  'csv-files': String.raw`
import os, tempfile
p = os.path.join(tempfile.mkdtemp(), "t.csv")
rows = [{"name": "Sam, Jr", "says": 'He said "hi"'}, {"name": "Ali", "says": "line one\nline two"}]
write_rows(p, rows)
assert read_rows(p) == rows`,
  'json-data': String.raw`
import os, tempfile
p = os.path.join(tempfile.mkdtemp(), "d.json")
assert load_json(p, []) == []
save_json({"a": [1, 2], "é": "ü"}, p)
assert load_json(p) == {"a": [1, 2], "é": "ü"}
open(p, "w").write("{broken")
assert load_json(p, "fallback") == "fallback"`,
  'group-count': String.raw`
assert count_each(["a", "b", "a"]) == {"a": 2, "b": 1}
assert total_by([{"c": "x", "v": 2}, {"c": "x", "v": 3}, {"c": "y", "v": 1}], "c", "v") == {"x": 5, "y": 1}`,
  'dates-times': String.raw`
assert days_between("2026-11-01T00:00:00+00:00", "2026-11-04T12:00:00+00:00") == 3
assert add_days("2026-12-31T10:00:00+00:00", 1) == "2027-01-01T10:00:00+00:00"
assert now_utc().endswith("+00:00")`,
  'search-filter': String.raw`
assert search(["Gain in decibels", "Pan laws", "Peak meter"], "PE me") == ["Peak meter"]
assert search(["a"], "") == ["a"]`,
  'sorting': String.raw`
products = [{"price": 2, "name": "b"}, {"price": 1, "name": "z"}, {"price": 2, "name": "A"}]
assert [p["name"] for p in sort_by_price(products)] == ["z", "A", "b"]
assert [p["date"] for p in newest_first([{"date": "2026-01-02"}, {"date": "2026-03-01"}])] == ["2026-03-01", "2026-01-02"]`,
  'text-file': String.raw`
import os, tempfile
p = os.path.join(tempfile.mkdtemp(), "t.txt")
write_text(p, "one\n")
add_line(p, "two")
assert read_text(p) == "one\ntwo\n" and count_lines(p) == 2`,
  'folder-walk': String.raw`
import os, tempfile
d = tempfile.mkdtemp()
os.makedirs(os.path.join(d, "sub"))
open(os.path.join(d, "a.wav"), "wb").write(b"12345")
open(os.path.join(d, "sub", "b.WAV"), "wb").write(b"123")
open(os.path.join(d, "c.txt"), "w").write("x")
assert [p.name for p in files_under(d, ".wav")] == ["a.wav", "b.WAV"]
assert total_size(d) == 9 and newest_file(d) is not None`,
  'command-line-args': String.raw`
a = read_arguments(["song.wav", "--gain", "-6", "--dry-run"])
assert a.file == "song.wav" and a.gain == -6.0 and a.dry_run`,
  'settings-file': String.raw`
import os, tempfile
p = os.path.join(tempfile.mkdtemp(), "s.json")
s = load_settings(p)
assert s == DEFAULTS
s["theme"] = "light"
save_settings(s, p)
assert load_settings(p)["theme"] == "light" and load_settings(p)["volume_db"] == -6.0
assert not os.path.exists(p + ".tmp")`,
  'logging': String.raw`
import os, tempfile
p = os.path.join(tempfile.mkdtemp(), "app.log")
log = start_logging(p)
log.info("hello from the test")
for h in logging.getLogger().handlers:
    h.flush()
assert "INFO hello from the test" in open(p, encoding="utf-8").read()`,
  'timing': String.raw`
assert time_it(lambda: sum(range(1000)), runs=3) >= 0`,
  'env-vars': String.raw`
os.environ["LIBRARY_TEST_X"] = "abc"
assert setting("LIBRARY_TEST_X") == "abc" and setting("LIBRARY_TEST_MISSING", "d") == "d"
try:
    required_setting("LIBRARY_TEST_MISSING")
    raise AssertionError("a missing required setting must stop the program")
except SystemExit as stop:
    assert "LIBRARY_TEST_MISSING" in str(stop)
os.environ["PORT"] = "9001"
assert port_number() == 9001`,
  'cache-ttl': String.raw`
calls = []
def fetch():
    calls.append(1)
    return len(calls)
assert cached("k", fetch) == 1 and cached("k", fetch) == 1 and len(calls) == 1
assert cached("k2", fetch, seconds=-1) == 2 and cached("k2", fetch, seconds=-1) == 3`,
  'undo-redo': String.raw`
h = History("a")
h.change("b")
h.change("c")
assert h.undo() == "b" and h.undo() == "a" and h.undo() == "a" and h.redo() == "b"
h.change("x")
assert h.redo() == "x"`,
  'udp-messages': String.raw`
import threading, time
got = []
listener = threading.Thread(target=lambda: got.append(listen(port=47123, seconds=5.0, host="127.0.0.1")))
listener.start()
time.sleep(0.3)
send_message("tally on", "127.0.0.1", 47123)
listener.join()
assert got[0][0] == "tally on"
assert listen(port=47124, seconds=0.1, host="127.0.0.1") is None`,
  'rate-limit': String.raw`
b = TokenBucket(3, 0.0001)
assert [b.allow() for _ in range(5)] == [True, True, True, False, False]`,
  'password-hash': String.raw`
stored = hash_password("correct horse")
assert stored.startswith("scrypt$17$8$1$")
assert check_password("correct horse", stored) and not check_password("wrong", stored)
assert hash_password("correct horse") != stored, "a new salt each time"`,
  'random-token': String.raw`
a, b = new_token(), new_token()
assert len(a) >= 43 and a != b`,
  'safe-text': String.raw`
assert comment_html("<b>", "x & y") == "<p><b>&lt;b&gt;</b>: x &amp; y</p>"`,
  'sql-parameters': String.raw`
db = sqlite3.connect(":memory:")
db.execute("CREATE TABLE customers (id INTEGER PRIMARY KEY, name TEXT, email TEXT)")
db.execute("INSERT INTO customers (name, email) VALUES ('Sam', 'sam@example.com')")
assert find_customer(db, "sam@example.com") == (1, "Sam")
assert find_customer(db, "x' OR '1'='1") is None`,
  'signed-messages': String.raw`
stamp = str(int(time.time()))
signature = sign("key", b'{"a":1}', stamp)
assert is_genuine("key", b'{"a":1}', stamp, signature)
assert not is_genuine("key", b'{"a":2}', stamp, signature)
assert not is_genuine("other key", b'{"a":1}', stamp, signature)
assert not is_genuine("key", b'{"a":1}', "1000", sign("key", b'{"a":1}', "1000"))`,
  'thermistor': String.raw`
assert abs(celsius_from(0.5) - 25.0) < 1e-9 and celsius_from(0.4) > 25 > celsius_from(0.6)`,
  'form-check': String.raw`
assert signup_problems("sam@example.com", "a long enough password") == []
assert len(signup_problems("nope", "short")) == 2`,
  'progress-bar': String.raw`
assert progress_line(5, 10, 10) == "[#####-----] 50%"
assert progress_line(0, 0, 4) == "[----] 0%"`,
  'fetch-retry': String.raw`
import io
real_open, real_sleep = urllib.request.urlopen, time.sleep
calls = []
def flaky(url, timeout=None):
    calls.append(url)
    if len(calls) < 3:
        raise urllib.error.URLError("down")
    return io.BytesIO(b'{"ok": true}')
def missing(url, timeout=None):
    calls.append(url)
    raise urllib.error.HTTPError(url, 404, "Not Found", {}, None)
try:
    urllib.request.urlopen, time.sleep = flaky, lambda s: None
    assert fetch_json("http://example.test/api") == {"ok": True} and len(calls) == 3
    calls.clear()
    urllib.request.urlopen = missing
    try:
        fetch_json("http://example.test/nothing")
        raise AssertionError("a 404 must fail")
    except ConnectionError as problem:
        assert "404" in str(problem) and len(calls) == 1, "a 404 isn't retried"
finally:
    urllib.request.urlopen, time.sleep = real_open, real_sleep`,
  'game-loop': String.raw`
steps, draws = [], []
run_game(lambda dt: steps.append(dt), lambda: draws.append(1), 0.1)
assert 3 <= len(steps) <= 10 and draws and all(abs(dt - 1 / 60) < 1e-12 for dt in steps)`,
  'osc-messages': String.raw`
assert osc_text("abc") == b"abc\0" and osc_text("abcd") == b"abcd\0\0\0\0"
packet = osc_message("/mixer/fader/1", [0.75, 3, "vox"])
assert len(packet) % 4 == 0
assert parse_osc(packet) == ("/mixer/fader/1", [0.75, 3, "vox"])`,
  'python-sqlite': String.raw`
db = open_database(":memory:")
first = add_take(db, "Intro", 12.5)
add_take(db, "Intro", 9.0)
assert first == 1 and [t["seconds"] for t in takes_called(db, "Intro")] == [12.5, 9.0]
try:
    add_take(db, "Bad", -1)
    raise AssertionError("the CHECK in schema.sql must refuse it")
except sqlite3.IntegrityError:
    pass`,
  'node-py-stdio': String.raw`
reply = handle({"op": "gain", "db": -20, "samples": [1.0], "id": 7})
assert reply["id"] == 7 and abs(reply["result"][0] - 0.1) < 1e-12
assert handle({"op": "nope", "id": 1})["error"] == "unknown op"`,
  'shared-settings': String.raw`
import os
s = load_settings(os.path.join(os.path.dirname(__file__), "settings.json"))
assert s["theme"] == "dark" and s["sample_rate"] == 48000 and s["meter_fall_db_per_second"] == 20`,
};

const RUNNER = String.raw`
import json, os, sys, tempfile, traceback
sys.stdin.reconfigure(encoding="utf-8")
sys.stdout.reconfigure(encoding="utf-8")
out = {}
for job in json.load(sys.stdin):
    folder = tempfile.mkdtemp()
    for name, text in job["files"].items():
        with open(os.path.join(folder, os.path.basename(name)), "w", encoding="utf-8") as f:
            f.write(text)
    ns = {"__name__": "library_check", "__file__": os.path.join(folder, "main.py")}
    try:
        for name, code in job["codes"]:
            exec(compile(code, job["id"] + " " + name, "exec"), ns)
        exec(compile(job["check"], job["id"] + " (check)", "exec"), ns)
        out[job["id"]] = "ok"
    except BaseException:
        out[job["id"]] = traceback.format_exc()
print(json.dumps(out))
`;

test('library: the generated Python gives the right numbers', () => {
  const jobs = Object.entries(PY_CHECKS).map(([id, check]) => {
    const p = LIB.part(id);
    assert.ok(p, `there's a check for ${id}, but no such part`);
    const codes = translated.filter(t => t.part.id === id && t.v.lang === 'python').map(t => [t.v.file, t.code]);
    assert.ok(codes.length, `${id} has no Python`);
    const files = Object.fromEntries(p.variants.filter(v => ['sql', 'json'].includes(v.lang)).map(v => [v.file, v.text]));
    return { id, codes, check, files };
  });
  const r = spawnSync(PYTHON, ['-c', RUNNER], { input: JSON.stringify(jobs), maxBuffer: 64 * 1024 * 1024, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const results = JSON.parse(r.stdout);
  const failed = Object.entries(results).filter(([, v]) => v !== 'ok');
  assert.deepEqual(failed, []);
  assert.ok(jobs.length >= 50, `only ${jobs.length} Python checks`);
});

test('library: the Node and Python worker answer each other through standard input and output', () => {
  const worker = codeOf('node-py-stdio', 'worker.py').code;
  const out = execFileSync(PYTHON, ['-c', worker], { input: '{"op": "gain", "db": -6, "samples": [1], "id": 1}\n{"op": "x", "id": 2}\n', encoding: 'utf8' });
  const replies = out.trim().split(/\r?\n/).map(l => JSON.parse(l));
  assert.equal(replies[0].id, 1);
  assert.ok(Math.abs(replies[0].result[0] - 0.501) < 0.001);
  assert.equal(replies[1].error, 'unknown op');
});

/* ------------------------------------------------------------------ the numbers: generated JavaScript */

/* A browser stand-in: anything asked of the page gives back something that can be used again, so the
 * generated code runs; real JavaScript names (Math, JSON, crypto, TextEncoder, Blob) are the real ones. */
function anything() {
  const fn = function () {};
  return new Proxy(fn, {
    get(t, k) {
      if (k === Symbol.toPrimitive) return () => 0;
      if (k === Symbol.iterator) return function* () {};
      if (k === 'then') return undefined;
      if (typeof k === 'symbol') return undefined;
      return anything();
    },
    set: () => true,
    apply: () => anything(),
    construct: () => anything(),
  });
}
function browser(logged = []) {
  const store = new Map();
  const ctx = {
    console: { log: (...a) => logged.push(a.join(' ')), warn: () => {}, error: () => {} },
    document: anything(), navigator: anything(), matchMedia: anything(), AudioContext: anything(), Image: anything(), WebSocket: anything(),
    TextDecoderStream: anything(), alert: () => {}, prompt: () => '',
    localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
    requestAnimationFrame: () => 0, setTimeout: () => 0, setInterval: () => 0, clearTimeout: () => {}, clearInterval: () => {},
    fetch: async () => ({ ok: true, status: 200, json: async () => ({}) }),
    performance, crypto: globalThis.crypto, TextEncoder, TextDecoder, Blob, AbortSignal,
  };
  ctx.window = ctx;
  ctx.ok = (cond, msg) => { if (!cond) throw new Error('check failed: ' + (msg || '')); };
  ctx.near = (a, b, tol = 1e-9, msg = '') => { if (!(Math.abs(a - b) <= tol)) throw new Error(`check failed: ${a} isn't within ${tol} of ${b} ${msg}`); };
  return vm.createContext(ctx);
}

test('library: the generated page JavaScript runs in a browser stand-in', async () => {
  for (const { part, v, code } of translated) {
    if (v.lang !== 'js' || /\brequire\(/.test(code)) continue;
    try { const r = vm.runInContext(code, browser(), { filename: `${part.id}/${v.file}` }); if (r && typeof r.then === 'function') await r; }
    catch (e) { assert.fail(`${part.id} ${v.file}: ${e.message}\n${code}`); }
  }
});

const JS_CHECKS = {
  'gain-db': `near(gainFromDb(-6), 0.501, 0.001); ok(dbFromGain(0, -120) === -120); near(dbFromGain(0.5, -120), -6.0206, 0.001);
    const a = new Float32Array([1, -0.5]); applyGain(a, -20); near(a[0], 0.1, 1e-6);`,
  'pan-law': `const [l, r] = constantPowerPan(0); near(l, Math.SQRT1_2); near(l * l + r * r, 1);
    for (const p of [-1, -0.4, 0.7, 1]) { const [a, b] = constantPowerPan(p); near(a * a + b * b, 1); }
    ok(linearPan(1)[1] === 1 && linearPan(0)[0] === 0.5);`,
  'peak-meter': `const m = createPeakMeter(48000, 20, 1); updatePeakMeter(m, new Float32Array(480).fill(0.5)); near(m.levelDb, -6.0206, 0.01);
    for (let i = 0; i < 50; i++) updatePeakMeter(m, new Float32Array(480)); near(m.levelDb, -16.0206, 0.05); near(m.peakDb, -6.0206, 0.01);`,
  'biquad': `const resp = (c, f) => { const w = 2 * Math.PI * f / 48000, re = (k) => Math.cos(k * w), im = (k) => -Math.sin(k * w);
      const nr = c.b0 + c.b1 * re(1) + c.b2 * re(2), ni = c.b1 * im(1) + c.b2 * im(2), dr = 1 + c.a1 * re(1) + c.a2 * re(2), di = c.a1 * im(1) + c.a2 * im(2);
      return Math.hypot(nr, ni) / Math.hypot(dr, di); };
    const lp = biquadCoefficients("low-pass", 1000, 0.7071, 48000, 0); near(resp(lp, 0), 1); near(resp(lp, 24000), 0); near(runBiquad(new Float32Array(4800).fill(1), lp)[4799], 1, 1e-5);
    near(20 * Math.log10(resp(biquadCoefficients("peaking", 1000, 1, 48000, 6), 1000)), 6, 0.01);
    near(20 * Math.log10(resp(biquadCoefficients("low shelf", 200, 0.7071, 48000, 6), 1)), 6, 0.01);
    near(20 * Math.log10(resp(biquadCoefficients("high shelf", 5000, 0.7071, 48000, -6), 24000)), -6, 0.01);
    near(resp(biquadCoefficients("high-pass", 1000, 0.7071, 48000, 0), 0), 0);`,
  'smoother': `const s = createSmoother(48000, 0.01, 0); s.target = 1; for (let i = 0; i < 480; i++) nextValue(s); near(s.value, 1 - Math.exp(-1));`,
  'crossfade': `for (const p of [0, 0.3, 0.5, 1]) { const [a, b] = equalPowerGains(p); near(a * a + b * b, 1); }`,
  'waveshaper': `ok(softClip(2) === 1 && softClip(-2) === -1); near(softClip(0.01), 0.015, 1e-4);
    const curve = makeCurve(5, 1); near(curve[0], Math.tanh(-1), 1e-7); near(curve[2], 0, 1e-7); near(curve[4], Math.tanh(1), 1e-7);`,
  'wav-file': `(async () => { const blob = encodeWav(new Float32Array([0, 0.5, -1]), 48000); ok(blob.size === 50 && blob.type === "audio/wav");
    const v = new DataView(await blob.arrayBuffer()); ok(v.getUint32(0, false) === 0x52494646, "RIFF"); ok(v.getUint32(24, true) === 48000);
    ok(v.getInt16(46, true) === 16384 && v.getInt16(48, true) === -32767); })()`,
  'midi-note-frequency': `ok(noteToFrequency(69, 440) === 440); near(noteToFrequency(60, 440), 261.6256, 1e-4); near(frequencyToNote(261.6256, 440), 60, 1e-4);`,
  'note-names': `ok(noteName(60) === "C4" && noteName(0) === "C-1" && noteNumber("F#3") === 54 && noteNumber("C4") === 60);`,
  'scales-chords': `ok(JSON.stringify(scaleNotes(60, "major")) === "[60,62,64,65,67,69,71]" && JSON.stringify(chordNotes(57, "minor")) === "[57,60,64]");`,
  'tempo-grid': `ok(samplesPerBeat(120, 48000) === 24000 && JSON.stringify(barsBeatsTicks(24000 * 5 + 12000, 120, 48000, 4, 960)) === "[2,2,480]");`,
  'oscillator': `near(waveAt("sine", 0.25), 1); ok(waveAt("square", 0.75) === -1); near(waveAt("triangle", 0), -1); near(waveAt("saw", 0.5), 0);`,
  'colour-codes': `ok(JSON.stringify(hexToRgb("#4f7cff")) === "[79,124,255]" && rgbToHex(79, 124, 255) === "#4f7cff" && rgbToHex(0, 0, 0) === "#000000");`,
  'rotate-point': `const [x, y] = rotatePoint(2, 1, 1, 1, 90); near(x, 1); near(y, 2);`,
  'polygon-points': `ok(starPoints(5, 0, 0, 2, 1).length === 10); near(Math.hypot(...starPoints(5, 0, 0, 2, 1)[1]), 1);`,
  'box-collision': `ok(boxesOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 }) && !boxesOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 5, h: 5 }));`,
  'circle-collision': `ok(circlesOverlap(0, 0, 1, 1.5, 0, 1) && !circlesOverlap(0, 0, 1, 3, 0, 1));`,
  'gravity-jump': `const b = { y: 0, speed: 0, standing: false }; for (let i = 0; i < 600; i++) stepBody(b, 1 / 60, 100); ok(b.y === 100 && b.standing);
    jump(b); ok(b.speed === JUMP_SPEED && !b.standing);`,
  'tile-map': `ok(isSolid(0, 0) && !isSolid(20, 20) && isSolid(-5, 20) && isSolid(3 * 16 + 1, 2 * 16 + 1));`,
  'camera-follow': `let x = 0; for (let i = 0; i < 600; i++) x = follow(x, 500, 1 / 60, 200, 1000); near(x, 400, 0.01); ok(follow(900, 2000, 1, 200, 1000) === 800);`,
  'game-states': `ok(nextState("menu", "start") === "playing" && nextState("menu", "pause") === "menu");`,
  'high-score': `ok(bestScore() === 0 && recordScore(10) === 10 && recordScore(5) === 10 && bestScore() === 10);`,
  'weighted-random': `let a = 0; for (let i = 0; i < 4000; i++) if (pickWeighted(["a", "b"], [3, 1]) === "a") a++; ok(a / 4000 > 0.7 && a / 4000 < 0.8, a);`,
  'easing': `ok(smoothstep(0.5) === 0.5 && tween(10, 20, 2) === 20 && tween(10, 20, 0) === 10);`,
  'clamp-lerp-map': `ok(clamp(5, 0, 3) === 3 && lerp(0, 10, 0.25) === 2.5 && mapRange(5, 0, 10, 100, 200) === 150);`,
  'vectors-2d': `const [x, y] = normalised(3, 4); near(x, 0.6); near(y, 0.8); ok(normalised(0, 0)[0] === 0 && dot(1, 0, 0, 1) === 0);`,
  'moving-average': `ok(JSON.stringify(exponentialAverage([0, 10, 10, 10], 0.5)) === "[0,5,7.5,8.75]");`,
  'statistics': `ok(mean([1, 2, 3]) === 2 && median([3, 1, 2]) === 2 && median([1, 2, 3, 4]) === 2.5);`,
  'angles': `near(angleTo(0, 0, 0, 1), 90); ok(turnBy(350, 10) === 20 && turnBy(10, 350) === -20);`,
  'csv-files': `ok(JSON.stringify(parseCsvLine('a,"b, c","say ""hi"""')) === JSON.stringify(["a", "b, c", 'say "hi"']) && parseCsvLine("").length === 1);`,
  'json-data': `ok(fromJson("{bad", "fb") === "fb" && fromJson('{"a":1}', null).a === 1 && toJson({ a: 1 }).includes('"a": 1'));`,
  'group-count': `ok(JSON.stringify(countEach(["a", "b", "a"])) === '{"a":2,"b":1}');`,
  'dates-times': `ok(daysBetween("2026-11-01T00:00:00Z", "2026-11-04T12:00:00Z") === 3 && nowUtc().endsWith("Z") && typeof showDate("2026-11-04T09:30:00Z") === "string");`,
  'search-filter': `ok(JSON.stringify(search(ITEMS, "PE me")) === '["Peak meter"]');`,
  'sorting': `ok(byPriceThenName([{ price: 2, name: "b" }, { price: 1, name: "z" }, { price: 2, name: "a" }]).map((p) => p.name).join() === "z,a,b");
    ok(newestFirst([{ date: "2026-01-02" }, { date: "2026-03-01" }])[0].date === "2026-03-01");`,
  'undo-redo': `const h = createHistory("a"); change(h, "b"); change(h, "c"); ok(undo(h) === "b" && undo(h) === "a" && undo(h) === "a" && redo(h) === "b");
    change(h, "x"); ok(redo(h) === "x");`,
  'cache-ttl': `let n = 0; const f = () => ++n; ok(cached("k", f, 60) === 1 && cached("k", f, 60) === 1 && n === 1); ok(cached("k2", f, -1) === 2 && cached("k2", f, -1) === 3);`,
  'rate-limit': `const b = createBucket(3, 0.0001); ok(JSON.stringify([allow(b), allow(b), allow(b), allow(b), allow(b)]) === "[true,true,true,false,false]");`,
  'random-token': `const t = newToken(); ok(t.length === 64 && /^[0-9a-f]+$/.test(t) && t !== newToken());`,
  'password-hash': `(async () => { const salt = new Uint8Array(16); const a = await hashPassword("pw", salt); ok(a.length === 64 && a === await hashPassword("pw", salt) && a !== await hashPassword("pw2", salt)); })()`,
  'signed-messages': `(async () => { const e = new TextEncoder(); const key = await crypto.subtle.importKey("raw", e.encode("key"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const hex = Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", key, e.encode("body"))), (b) => b.toString(16).padStart(2, "0")).join("");
    ok(await isGenuine("key", "body", hex) && !(await isGenuine("key", "bodY", hex)) && !(await isGenuine("other", "body", hex))); })()`,
  'safe-text': `ok(escapeHtml(\`<a href="x">'&'</a>\`) === "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");`,
  'logging': `log("info", "hi"); log("debug", "hidden"); ok(LOGGED.length === 1 && / INFO hi$/.test(LOGGED[0]), LOGGED);`,
  'timing': `ok(timeIt(() => 1, 3) >= 0);`,
  'browser-storage': `ok(loadData("fb") === "fb"); saveData({ a: 1 }); ok(loadData(null).a === 1); localStorage.setItem("my-app", "{bad"); ok(loadData("fb") === "fb");`,
  'fetch-retry': `(async () => { let calls = 0; setTimeout = (f) => f();
    fetch = async () => { calls++; if (calls < 3) throw new Error("down"); return { ok: true, status: 200, json: async () => ({ a: 1 }) }; };
    ok((await fetchJson("u", 4)).a === 1 && calls === 3);
    calls = 0; fetch = async () => { calls++; return { ok: false, status: 404 }; };
    let said = ""; try { await fetchJson("u", 4); } catch (e) { said = e.message; } ok(/404/.test(said) && calls === 1, said); })()`,
};

test('library: the generated JavaScript gives the right numbers', async () => {
  for (const [id, check] of Object.entries(JS_CHECKS)) {
    const t = translated.find(x => x.part.id === id && x.v.lang === 'js');
    assert.ok(t, `there's a check for ${id}, but it has no JavaScript`);
    const logged = [];
    const ctx = browser(logged);
    ctx.LOGGED = logged;
    try {
      const r = vm.runInContext(t.code + '\n;' + check, ctx, { filename: `${id}/${t.v.file}` });
      if (r && typeof r.then === 'function') await r;
    } catch (e) { assert.fail(`${id}: ${e.message}`); }
  }
  assert.ok(Object.keys(JS_CHECKS).length >= 40);
});

test('the page loads every Library pack and the kit packs, before what reads them', () => {
  const page = readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const at = (f) => page.indexOf(`<script src="${f}"></script>`);
  for (const f of LIBRARY_PACKS) {
    assert.ok(at(f) > 0, `index.html doesn't load ${f}`);
    assert.ok(at(f) < at('lang/library.js'), `${f} must load before lang/library.js`);
  }
  assert.ok(at('lang/languages.js') < at('lang/library.js') && at('lang/library.js') < at('app.js'));
  for (const f of readdirSync(path.join(ROOT, 'lang/kits')).filter(f => f.endsWith('.js'))) assert.ok(at('lang/kits/' + f) > 0 && at('lang/kits/' + f) < at('lang/builder.js'), `index.html must load lang/kits/${f} before the builder`);
});

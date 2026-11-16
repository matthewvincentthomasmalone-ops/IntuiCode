// Does the C++ writer mean what its words say? Runs examples (tests/helpers/meaning_cpp_examples.mjs) as real C++:
// each example is translated, put in a namespace of its own, and all of them are compiled into one program (g++,
// or Visual Studio's cl on Windows) and run. Programs run with std::cin and std::cout swapped for text of their own;
// sketches run on a stand-in board (pins, the clock, the serial monitor, a screen and a servo record what they're
// asked to do). Waits are recorded, not waited. The C++ writer's value words are written in place, like the
// JavaScript writer's, so what's counted is its Index: the sentences (TEMPLATES) and value words (WORDS,
// ARDUINO_WORDS) it offers.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { entryPattern } from './meaning_web.mjs';

/* ---- A compiler: g++, or cl with Visual Studio's settings ---- */

let compiler;
export function findCompiler() {
  if (compiler !== undefined) return compiler;
  compiler = null;
  if (spawnSync('g++', ['--version']).status === 0) return (compiler = { name: 'g++' });
  if (process.platform !== 'win32') return compiler;
  const where = path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Microsoft Visual Studio', 'Installer', 'vswhere.exe');
  if (!existsSync(where)) return compiler;
  const at = spawnSync(where, ['-latest', '-products', '*', '-property', 'installationPath'], { encoding: 'utf8' }).stdout.trim().split(/\r?\n/)[0];
  const vcvars = at && path.join(at, 'VC', 'Auxiliary', 'Build', 'vcvars64.bat');
  if (!vcvars || !existsSync(vcvars)) return compiler;
  const set = spawnSync('cmd.exe', ['/d', '/s', '/c', `"call "${vcvars}" >nul && set"`], { encoding: 'utf8', windowsVerbatimArguments: true });
  if (set.status !== 0) return compiler;
  const env = {};
  for (const line of set.stdout.split(/\r?\n/)) { const k = line.indexOf('='); if (k > 0) env[line.slice(0, k)] = line.slice(k + 1); }
  return (compiler = { name: 'cl', env });
}

function build(source, dir) {
  const c = findCompiler();
  const src = path.join(dir, 'examples.cpp'), exe = path.join(dir, process.platform === 'win32' ? 'examples.exe' : 'examples');
  writeFileSync(src, source);
  const r = c.name === 'g++'
    ? spawnSync('g++', ['-std=c++20', '-O0', '-w', '-fmax-errors=50', src, '-o', exe], { encoding: 'utf8' })
    : spawnSync('cl.exe', ['/nologo', '/std:c++20', '/EHsc', '/W0', '/bigobj', '/permissive-', src, `/Fe:${exe}`, `/Fo:${path.join(dir, 'examples.obj')}`], { encoding: 'utf8', env: c.env, cwd: dir });
  return { ok: r.status === 0, exe, said: (r.stdout || '') + (r.stderr || '') };
}
/* The lines of the source an error is on (g++: file:12:5: error, cl: file(12): error). */
const errorLines = (said) => [...said.matchAll(/examples\.cpp(?::(\d+):\d+:\s*error|\((\d+)(?:,\d+)?\)\s*:\s*(?:fatal )?error)/g)].map(m => +(m[1] || m[2]));

/* ---- What runs around the examples ---- */

const COMMON = String.raw`
#include <algorithm>
#include <chrono>
#include <cmath>
#include <cstdarg>
#include <cstdio>
#include <charconv>
#include <iostream>
#include <map>
#include <random>
#include <sstream>
#include <stdexcept>
#include <string>
#include <thread>
#include <type_traits>
#include <vector>
namespace intui {
  std::vector<long long> slept;
  template <class R, class P> void sleep_for(std::chrono::duration<R, P> d) { slept.push_back((long long)std::chrono::duration_cast<std::chrono::microseconds>(d).count()); }
  inline int printf_(const char* f, ...) { char buf[4096]; va_list a; va_start(a, f); int n = vsnprintf(buf, sizeof buf, f, a); va_end(a); std::cout << buf; return n; }
  inline std::string esc(const std::string& s) {
    std::string o;
    for (unsigned char c : s) {
      if (c == '"' || c == '\\') { o += '\\'; o += (char)c; }
      else if (c == '\n') o += "\\n";
      else if (c == '\t') o += "\\t";
      else if (c < 32) { char b[8]; std::snprintf(b, sizeof b, "\\u%04x", c); o += b; }
      else o += (char)c;
    }
    return o;
  }
  template <class T> struct is_vec : std::false_type {};
  template <class T, class A> struct is_vec<std::vector<T, A>> : std::true_type {};
  template <class T> struct is_map : std::false_type {};
  template <class K, class V, class C, class A> struct is_map<std::map<K, V, C, A>> : std::true_type {};
  /* A value as text: whole numbers as they are, decimals always with a point (3.0), text in quotes, yes/no as
     true/false, a character in single quotes, lists in [ ], maps in { }. */
  template <class T> std::string repr(const T& v) {
    if constexpr (std::is_same_v<T, bool>) return v ? "true" : "false";
    else if constexpr (std::is_same_v<T, char>) return std::string("'") + v + "'";
    else if constexpr (std::is_integral_v<T> || std::is_enum_v<T>) return std::to_string((long long)v);
    else if constexpr (std::is_floating_point_v<T>) {
      char b[64]; auto r = std::to_chars(b, b + sizeof b, (double)v); std::string s(b, r.ptr);
      if (s.find_first_of(".einf") == std::string::npos) s += ".0";
      return s;
    }
    else if constexpr (std::is_array_v<T> && !std::is_same_v<std::remove_cv_t<std::remove_extent_t<T>>, char>) { std::string s = "["; for (std::size_t i = 0; i < std::extent_v<T>; i++) s += (i ? ", " : "") + repr(v[i]); return s + "]"; }
    else if constexpr (is_vec<T>::value) { std::string s = "["; for (std::size_t i = 0; i < v.size(); i++) s += (i ? ", " : "") + repr(v[i]); return s + "]"; }
    else if constexpr (is_map<T>::value) { std::string s = "{"; bool first = true; for (const auto& [k, w] : v) { s += (first ? "" : ", ") + repr(k) + ": " + repr(w); first = false; } return s + "}"; }
    else if constexpr (requires { v.c_str(); }) return "\"" + std::string(v.c_str()) + "\"";
    else if constexpr (std::is_convertible_v<T, std::string>) return "\"" + std::string(v) + "\"";
    else return "<a value>";
  }
  std::string vals, checks;
  template <class T> void report(const char* name, const T& v) { vals += (vals.empty() ? "" : ",") + std::string("\"") + name + "\":\"" + esc(repr(v)) + "\""; }
  inline void check(const char* what, bool ok) { if (!ok) checks += (checks.empty() ? "" : ",") + std::string("\"") + esc(what) + "\""; }
  inline bool last_round = true;
  inline unsigned long long seed = 7;
  inline unsigned long long next() { seed = seed * 6364136223846793005ULL + 1442695040888963407ULL; return seed >> 33; }
}
`;

/* The stand-in board: what a sketch asks of it is recorded in order ("does"), as one line each. */
const BOARD = String.raw`
namespace intui {
  std::vector<std::string> does;
  std::string serial;
  std::map<int, int> level;          // what a pin reads (digitalRead, analogRead): set by the example
  std::map<int, unsigned long> pulse;
  unsigned long clock_us = 0;
  inline void did(const std::string& s) { does.push_back(s); }
  template <class T> std::string str(const T& v) { std::ostringstream o; o << v; return o.str(); }
}
typedef unsigned char byte;
typedef bool boolean;
const int HIGH = 1, LOW = 0, INPUT = 0, OUTPUT = 1, INPUT_PULLUP = 2, LED_BUILTIN = 13;
const int A0 = 14, A1 = 15, A2 = 16, A3 = 17, A4 = 18, A5 = 19;
const int DEC = 10, HEX = 16, BIN = 2, OCT = 8;
inline std::string pinName(int p) { return p >= 14 && p <= 19 ? "A" + std::to_string(p - 14) : std::to_string(p); }
inline const char* modeName(int m) { return m == OUTPUT ? "OUTPUT" : m == INPUT_PULLUP ? "INPUT_PULLUP" : "INPUT"; }
inline void pinMode(int p, int m) { intui::did("pinMode " + pinName(p) + " " + modeName(m)); }
inline void digitalWrite(int p, int v) { intui::did("digitalWrite " + pinName(p) + (v ? " HIGH" : " LOW")); }
inline int digitalRead(int p) { auto i = intui::level.find(p); return i == intui::level.end() ? LOW : (i->second ? HIGH : LOW); }
inline int analogRead(int p) { auto i = intui::level.find(p); return i == intui::level.end() ? 0 : i->second; }
inline void analogWrite(int p, int v) { intui::did("analogWrite " + pinName(p) + " " + std::to_string(v)); }
inline void delay(unsigned long ms) { intui::did("delay " + std::to_string(ms)); intui::clock_us += ms * 1000; }
inline void delayMicroseconds(unsigned int us) { intui::did("delayMicroseconds " + std::to_string(us)); intui::clock_us += us; }
inline unsigned long millis() { return intui::clock_us / 1000; }
inline unsigned long micros() { return intui::clock_us; }
inline unsigned long pulseIn(int p, int v) { intui::did("pulseIn " + pinName(p) + (v ? " HIGH" : " LOW")); auto i = intui::pulse.find(p); return i == intui::pulse.end() ? 0 : i->second; }
inline void tone(int p, unsigned int f, unsigned long ms = 0) { intui::did("tone " + pinName(p) + " " + std::to_string(f) + (ms ? " " + std::to_string(ms) : "")); }
inline void noTone(int p) { intui::did("noTone " + pinName(p)); }
inline long random(long low, long high) { return high <= low ? low : low + (long)(intui::next() % (unsigned long long)(high - low)); }
inline long random(long high) { return random(0, high); }
inline void randomSeed(unsigned long) {}
inline long map(long v, long a, long b, long c, long d) { return (v - a) * (d - c) / (b - a) + c; }
template <class T, class L, class H> T constrain(T v, L lo, H hi) { return v < lo ? (T)lo : v > hi ? (T)hi : v; }
#define F(s) (s)
struct String {
  std::string s;
  String() {}
  String(const char* c) : s(c) {}
  String(const std::string& c) : s(c) {}
  String(char c) : s(1, c) {}
  String(int v) : s(std::to_string(v)) {}
  String(unsigned int v) : s(std::to_string(v)) {}
  String(long v) : s(std::to_string(v)) {}
  String(unsigned long v) : s(std::to_string(v)) {}
  String(double v, int places = 2) { char b[64]; std::snprintf(b, sizeof b, "%.*f", places, v); s = b; }
  String(float v, int places = 2) : String((double)v, places) {}
  const char* c_str() const { return s.c_str(); }
  unsigned int length() const { return (unsigned int)s.size(); }
  long toInt() const { return std::atol(s.c_str()); }
  float toFloat() const { return (float)std::atof(s.c_str()); }
  String& operator+=(const String& o) { s += o.s; return *this; }
  friend String operator+(const String& a, const String& b) { return String(a.s + b.s); }
  friend bool operator==(const String& a, const String& b) { return a.s == b.s; }
  friend bool operator!=(const String& a, const String& b) { return a.s != b.s; }
  friend std::ostream& operator<<(std::ostream& o, const String& v) { return o << v.s; }
};
struct SerialT {
  void begin(long baud) { intui::did("Serial.begin " + std::to_string(baud)); }
  template <class T> static std::string as(const T& v) { return intui::str(v); }
  static std::string as(double v) { return String(v, 2).s; }
  static std::string as(float v) { return String((double)v, 2).s; }
  static std::string as(bool v) { return v ? "1" : "0"; }
  template <class T> static std::string as(const T& v, int how) {
    if constexpr (std::is_floating_point_v<T>) return String((double)v, how).s;
    else { if (how == 10) return std::to_string((long long)v); std::string o; unsigned long long n = (unsigned long long)v; do { o = "0123456789ABCDEF"[n % how] + o; n /= how; } while (n); return o; }
  }
  template <class T> void print(const T& v) { intui::serial += as(v); }
  template <class T> void print(const T& v, int how) { intui::serial += as(v, how); }
  template <class T> void println(const T& v) { intui::serial += as(v) + "\n"; }
  template <class T> void println(const T& v, int how) { intui::serial += as(v, how) + "\n"; }
  void println() { intui::serial += "\n"; }
  explicit operator bool() const { return true; }
} Serial;
struct LiquidCrystal {
  template <class... P> LiquidCrystal(P...) {}
  void begin(int c, int r) { intui::did("lcd begin " + std::to_string(c) + " " + std::to_string(r)); }
  template <class T> void print(const T& v) { intui::did("lcd print " + SerialT::as(v)); }
  template <class T> void println(const T& v) { intui::did("lcd println " + SerialT::as(v)); }
  void setCursor(int c, int r) { intui::did("lcd setCursor " + std::to_string(c) + " " + std::to_string(r)); }
  void clear() { intui::did("lcd clear"); }
};
struct Servo {
  void attach(int p) { intui::did("servo attach " + pinName(p)); }
  void write(int d) { intui::did("servo write " + std::to_string(d)); }
};
`;

/* The example's sentences: its given lines as exact C++ (above main, or at the start of main), then its lines, or
   "set result to …" for a value. */
export const sentencesOf = (ex) => (ex.above ? ex.above.split('\n').map(l => 'above main: ' + l) : [])
  .concat(ex.given ? ex.given.split('\n').map(l => 'c++: ' + l) : [])
  .concat(ex.lines != null ? ex.lines.split('\n') : [`set result to ${ex.say}`]).join('\n') + '\n';
export const cppNameOf = (ex) => (ex.lines != null ? ex.lines.replace(/\n\s*/g, ' / ') : ex.say);
const isSketch = (ex) => ex.kind === 'sketch';

export function translate(CPP, ex) {
  const sketch = isSketch(ex);
  const r = CPP.compileCppProject({ kind: sketch ? 'arduino' : 'cpp', sections: [{ id: 'p', file: sketch ? 'sketch' : 'program', text: sentencesOf(ex) }] }).results.p;
  return { code: r.text, errs: r.info.flatMap(i => i.errs), warns: r.info.flatMap(i => i.warns) };
}

const cstr = (s) => '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"';
const NAME = /^[A-Za-z_]\w*$/;
/* One example's code, made ready to run with the others: in its own namespace, its #includes taken out (they're all
   above), waits and printf recorded, random numbers the same each run, and its checks added at the end. */
function wrap(ex, code, k) {
  const sketch = isSketch(ex);
  const lines = code.replace(/\r\n/g, '\n').split('\n').filter(l => !/^\s*#include\b/.test(l));
  let body = lines.join('\n')
    .replace(/std::this_thread::sleep_for\(/g, '::intui::sleep_for(')
    .replace(/(?<![\w:.>])printf\(/g, '::intui::printf_(')
    .replace(/std::random_device\{\}\(\)/g, '7u');
  const checks = [];
  if (ex.means !== undefined) checks.push('::intui::report("result", result);');
  for (const n of Object.keys(ex.names || {})) checks.push(NAME.test(n) ? `::intui::report(${cstr(n)}, ${n});` : `::intui::report(${cstr(n)}, (${n}));`);
  for (const h of [].concat(ex.holds || [])) checks.push(`::intui::check(${cstr(h)}, (${h}));`);
  // (a sketch's are checked once, in the last round)
  if (sketch && checks.length) checks.splice(0, checks.length, `if (::intui::last_round) { ${checks.join(' ')} }`);
  // the checks go at the end of main (before its return 0), or of the sketch's loop
  const end = sketch ? lastClose(body, /^void loop\(\)/m) : lastClose(body, /^int main\(\)/m);
  if (checks.length && end < 0) return null;
  if (checks.length) {
    const before = body.slice(0, end), ret = before.match(/\n(\s*)return 0;\s*$/);
    const at = ret ? end - ret[0].length : end;
    body = body.slice(0, at) + '\n' + checks.map(c => '    ' + c).join('\n') + body.slice(at);
  }
  body = body.replace(/^int main\(\)/m, 'int main_()');
  // (sketches: each tool declared first, as the Arduino builder does, so the order doesn't matter)
  const protos = sketch ? [...body.matchAll(/^([A-Za-z_][\w:<>]*[\s*&]+)([A-Za-z_]\w*)\(([^)]*)\)\s*\{/gm)].filter(m => !/^(?:setup|loop)$/.test(m[2])).map(m => `${m[1]}${m[2]}(${m[3]});`).join('\n') + '\n' : '';
  const defines = [...body.matchAll(/^\s*#define\s+([A-Za-z_]\w*)/gm)].map(m => `#undef ${m[1]}`).join('\n');
  return `namespace ex_${k} {\n${protos}${body}\n}\n${defines}\n`;
}
/* Where the closing brace of the function that starts at `re` is (its last line is a } at the left edge). */
function lastClose(body, re) {
  const m = body.match(re);
  if (!m) return -1;
  const close = body.indexOf('\n}', m.index);
  return close < 0 ? -1 : close;
}

function program(jobs, sketch) {
  let src = COMMON + (sketch ? BOARD : '') + '\n';
  const at = [];
  for (const j of jobs) {
    const from = src.split('\n').length;
    src += j.wrapped;
    at.push({ j, from, to: src.split('\n').length });
  }
  src += '\nint main(int argc, char** argv) {\n  int start = argc > 1 ? std::atoi(argv[1]) : 0;\n';
  jobs.forEach((j, i) => {
    const ex = j.ex;
    const set = sketch
      ? Object.entries(ex.inputs || {}).map(([p, v]) => `::intui::level[${/^A\d$/.test(p) ? 14 + +p.slice(1) : +p}] = ${v === 'HIGH' || v === true ? 1 : v === 'LOW' || v === false ? 0 : +v};`).join(' ')
        + Object.entries(ex.pulses || {}).map(([p, v]) => ` ::intui::pulse[${+p}] = ${+v};`).join('')
      : '';
    const call = sketch ? `ex_${j.k}::setup(); for (int r = 0; r < ${ex.rounds || 1}; r++) { ::intui::last_round = r == ${(ex.rounds || 1) - 1}; ex_${j.k}::loop(); }` : `ex_${j.k}::main_();`;
    src += `  if (start <= ${i}) {
    ::intui::vals.clear(); ::intui::checks.clear(); ::intui::slept.clear(); ::intui::seed = 7;${sketch ? ' ::intui::does.clear(); ::intui::serial.clear(); ::intui::level.clear(); ::intui::pulse.clear(); ::intui::clock_us = 0;' : ''}
    ${set}
    std::istringstream in(${cstr(ex.input || '')}); std::ostringstream out;
    auto* cin_was = std::cin.rdbuf(in.rdbuf()); auto* cout_was = std::cout.rdbuf(out.rdbuf());
    std::string raised;
    try { ${call} }
    catch (const std::invalid_argument& e) { raised = std::string("invalid_argument: ") + e.what(); }
    catch (const std::out_of_range& e) { raised = std::string("out_of_range: ") + e.what(); }
    catch (const std::runtime_error& e) { raised = std::string("runtime_error: ") + e.what(); }
    catch (const std::logic_error& e) { raised = std::string("logic_error: ") + e.what(); }
    catch (const std::exception& e) { raised = std::string("exception: ") + e.what(); }
    catch (...) { raised = "something thrown"; }
    std::cin.rdbuf(cin_was); std::cout.rdbuf(cout_was);
    std::string slept; for (auto s : ::intui::slept) slept += (slept.empty() ? "" : ",") + std::to_string(s);
    ${sketch ? 'std::string does; for (auto& d : ::intui::does) does += (does.empty() ? "" : ",") + std::string("\\"") + ::intui::esc(d) + "\\"";' : ''}
    std::cout << "@@{\\"at\\":${i},\\"out\\":\\"" << ::intui::esc(${sketch ? '::intui::serial' : 'out.str()'}) << "\\",\\"vals\\":{" << ::intui::vals << "},\\"failed\\":[" << ::intui::checks << "],\\"raised\\":\\"" << ::intui::esc(raised) << "\\",\\"slept\\":[" << slept << "]${sketch ? ',\\"does\\":[" << does << "]' : ''}}" << std::endl;
  }
`;
  });
  src += '  return 0;\n}\n';
  return { src, at };
}

/* Builds the jobs into one program and runs it. An example whose code doesn't build is taken out (it fails, with
   the compiler's words) and the rest built again; one that crashes or doesn't finish fails, and the rest run on.
   -> Map(job -> { got } | { why }) */
function buildAndRun(jobs, sketch, dir) {
  const out = new Map();
  let left = jobs.slice();
  for (let round = 0; left.length && round < 30; round++) {
    const { src, at } = program(left, sketch);
    const b = build(src, dir);
    if (!b.ok) {
      const bad = new Set(errorLines(b.said).map(n => at.find(a => n >= a.from && n < a.to)?.j));
      if (bad.has(undefined) || !bad.size) { for (const j of left) out.set(j, { why: `the examples don't build: ${b.said.slice(0, 600)}` }); return out; }
      for (const j of bad) out.set(j, { why: `doesn't build: ${firstError(b.said)}` });
      left = left.filter(j => !bad.has(j));
      continue;
    }
    let start = 0;
    while (start < left.length) {
      const r = spawnSync(b.exe, [String(start)], { encoding: 'utf8', timeout: 20000, maxBuffer: 64 * 1024 * 1024 });
      let last = start - 1;
      for (const line of (r.stdout || '').split(/\r?\n/)) {
        if (!line.startsWith('@@')) continue;
        const got = JSON.parse(line.slice(2));
        out.set(left[got.at], { got });
        last = got.at;
      }
      if (last + 1 < left.length) out.set(left[last + 1], { why: r.error?.code === 'ETIMEDOUT' ? "didn't finish (it was stopped after 20 seconds)" : `crashed (${r.status ?? r.signal})` });
      start = last + 2;
    }
    left = [];
  }
  return out;
}
const firstError = (said) => (said.split(/\r?\n/).find(l => /error/i.test(l)) || said.slice(0, 300)).trim();

/* Checks what one example did against what its words say. */
function judge(ex, got) {
  if (ex.raises) {
    return got.raised && got.raised.includes(ex.raises) ? { ok: true } : { ok: false, why: `should stop with ${ex.raises}, but ${got.raised ? `stopped with ${got.raised}` : "didn't stop"}` };
  }
  if (got.raised) return { ok: false, why: `stopped with ${got.raised}` };
  if (ex.means !== undefined && got.vals.result !== ex.means) return { ok: false, why: `gave ${got.vals.result}, but the words mean ${ex.means}` };
  for (const [n, want] of Object.entries(ex.names || {})) if (got.vals[n] !== want) return { ok: false, why: `${n} is ${got.vals[n]}, but should be ${want}` };
  if (got.failed.length) return { ok: false, why: `${got.failed[0]} isn't true` };
  if (ex.prints !== undefined && got.out !== ex.prints) return { ok: false, why: `showed ${JSON.stringify(got.out)}, but should show ${JSON.stringify(ex.prints)}` };
  if (ex.slept && got.slept.join(',') !== ex.slept.join(',')) return { ok: false, why: `waited ${JSON.stringify(got.slept)} microseconds, but should wait ${JSON.stringify(ex.slept)}` };
  if (ex.does !== undefined && got.does.join(' / ') !== ex.does) return { ok: false, why: `did ${JSON.stringify(got.does.join(' / '))}, but should do ${JSON.stringify(ex.does)}` };
  return { ok: true };
}

/* Runs the examples. Gives back one result each: { ex, code, ok, why }. Needs a compiler: see findCompiler. */
export function runCppExamples(CPP, examples, { only } = {}) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'intuicode-cpp-'));
  try {
    const results = examples.map((ex, k) => {
      const t = translate(CPP, ex);
      const r = { ex, k, code: t.code, warns: t.warns };
      if (t.errs.length) return { ...r, ok: false, why: `doesn't translate: ${t.errs[0]}` };
      r.wrapped = wrap(ex, t.code, k);
      if (r.wrapped == null) return { ...r, ok: false, why: 'has no main or loop to check at the end of' };
      return r;
    });
    const todo = results.filter(r => r.ok === undefined && (!only || only(r)));
    for (const sketch of [false, true]) {
      const jobs = todo.filter(r => isSketch(r.ex) === sketch);
      if (!jobs.length) continue;
      const ran = buildAndRun(jobs, sketch, dir);
      for (const j of jobs) {
        const o = ran.get(j) || { why: 'never ran' };
        Object.assign(j, o.got ? judge(j.ex, o.got) : { ok: false, why: o.why }, { got: o.got });
      }
    }
    for (const r of results) delete r.wrapped;
    return results;
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

/* ---- The Index: which of its entries an example says ---- */

/* The Index entries, each with the examples (that pass) that say it. A C++ program's entries and a sketch's are
   counted apart; so are the value words of each. */
export function cppIndexCoverage(CPP, results, notRun) {
  const entries = [];
  for (const [where, sec] of [['program', 'program'], ['sketch', 'sketch']]) {
    for (const t of [...CPP.TEMPLATES].filter(t => t.sections.includes(sec))) entries.push({ kind: 'statement', where, label: `${where}: ${t.pattern}`, pattern: t.pattern });
    for (const w of [...(sec === 'program' ? CPP.WORDS : CPP.ARDUINO_WORDS)]) entries.push({ kind: 'value', where, label: `${where}: ${w[0]} → ${w[1]}`, words: [w[0], w[1]] });
  }
  const seen = new Set();
  for (const e of entries) {
    // (the same sentence for a program and a sketch is one entry for each, but one line in the Index is counted once)
    const re = entryPattern(e);
    e.examples = results.filter(r => r.ok && (isSketch(r.ex) ? 'sketch' : 'program') === e.where)
      .filter(r => (r.ex.lines != null ? r.ex.lines.split('\n') : [r.ex.say]).some(l => (e.pattern ? re.test(l) : re.test(' ' + l.trim()))))
      .map(r => cppNameOf(r.ex));
    const k = Object.keys(notRun).find(k => e.label.startsWith(k));
    e.why = k ? notRun[k] : null;
    e.dup = seen.has(e.label);
    seen.add(e.label);
  }
  return entries.filter(e => !e.dup);
}

/* The writer's words for comparisons and maths (CPP_VALUE_WORDS) made wrong, one at a time: each gives the next
   one's code. Only the examples whose code changes are run again. Does one of them notice?
   -> { tried, missed: [words (written as …)] } */
export function mutateCppWords(CPP, examples, pick = () => true) {
  const W = CPP.CPP_VALUE_WORDS, missed = [];
  const before = examples.map(ex => translate(CPP, ex).code);
  let tried = 0;
  for (let i = 0; i < W.length; i++) {
    const was = W[i][1], other = W.slice(i + 1).concat(W.slice(0, i)).find(o => o[1] !== was);
    if (!other || !pick(W[i][0])) continue;
    tried++;
    W[i][1] = other[1];
    try {
      const changed = examples.filter((ex, k) => translate(CPP, ex).code !== before[k]);
      if (!changed.length || runCppExamples(CPP, changed).every(r => r.ok)) missed.push(`${W[i][0].source} (written as ${other[1].trim()})`);
    } finally { W[i][1] = was; }
  }
  return { tried, missed };
}

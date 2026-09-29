/* IntuiCode — runs real Python in the page with Pyodide.
 *
 * input() is handled by replay: when the program asks for something that
 * hasn't been typed yet, it stops, the terminal waits for an answer, and the
 * program is re-run from the top with every answer so far (same random seed,
 * so it behaves the same). Only the new output is shown.
 */
(function () {
  'use strict';

  const PYODIDE_VERSION = '0.26.4';
  const SOURCES = [
    new URL('pyodide/', location.href).href,
    `https://cdn.jsdelivr.net/npm/pyodide@${PYODIDE_VERSION}/`,
  ];

  const DRIVER = String.raw`
import sys, io, json, builtins, random, traceback, os, time, ast
_PB_DIR = "/home/pyodide/project"
os.makedirs(_PB_DIR, exist_ok=True)
if _PB_DIR not in sys.path:
    sys.path.insert(0, _PB_DIR)
_pb_ns = {"__name__": "__terminal__"}
_PB_LIMIT = 2_000_000

class _PBNeedInput(BaseException): pass
class _PBTooLong(BaseException): pass

class _PBOut(io.StringIO):
    def write(self, s):
        if self.tell() > 200_000:
            raise _PBTooLong()
        return super().write(s)

def _pb_guard():
    count = [0]
    def local(frame, event, arg):
        if event == "line":
            count[0] += 1
            if count[0] > _PB_LIMIT:
                raise _PBTooLong()
        return local
    def glob(frame, event, arg):
        fn = frame.f_code.co_filename
        if fn.startswith(_PB_DIR) or fn == "<terminal>":
            return local
        return None
    return glob

def _pb_where(e):
    tb = traceback.extract_tb(e.__traceback__)
    fr = [f for f in tb if f.filename.startswith(_PB_DIR) or f.filename == "<terminal>"]
    if not fr:
        return "", None
    return os.path.basename(fr[-1].filename), fr[-1].lineno

def _pb_write(name, text):
    with open(_PB_DIR + "/" + name, "w") as fh:
        fh.write(text)

def _pb_run(answers_json, seed, modules_json):
    answers = json.loads(answers_json)
    out = _PBOut()
    saved = (sys.stdout, sys.stderr, builtins.input, time.sleep)
    def fake_input(prompt=""):
        out.write(str(prompt))
        if answers:
            a = answers.pop(0)
            out.write(a + "\n")
            return a
        raise _PBNeedInput(str(prompt))
    for m in json.loads(modules_json):
        sys.modules.pop(m, None)
    random.seed(seed)
    res = {"status": "done"}
    path = _PB_DIR + "/main.py"
    g = {"__name__": "__main__", "__file__": path}
    sys.stdout = sys.stderr = out
    builtins.input = fake_input
    time.sleep = lambda s=0: None
    sys.settrace(_pb_guard())
    try:
        with open(path) as fh:
            src = fh.read()
        exec(compile(src, path, "exec"), g)
    except _PBNeedInput as e:
        res = {"status": "input", "prompt": str(e)}
    except _PBTooLong:
        res = {"status": "toolong"}
    except SystemExit:
        res = {"status": "exit"}
    except SyntaxError as e:
        res = {"status": "error", "type": "SyntaxError", "msg": e.msg or str(e),
               "file": os.path.basename(e.filename or ""), "line": e.lineno}
    except BaseException as e:
        f, ln = _pb_where(e)
        res = {"status": "error", "type": type(e).__name__, "msg": str(e), "file": f, "line": ln}
    finally:
        sys.settrace(None)
        sys.stdout, sys.stderr, builtins.input, time.sleep = saved
    if res["status"] in ("done", "exit"):
        _pb_ns.update({k: v for k, v in g.items() if not k.startswith("__")})
    res["out"] = out.getvalue()
    return json.dumps(res)

def _pb_repl(src):
    out = _PBOut()
    saved = (sys.stdout, sys.stderr, builtins.input)
    sys.stdout = sys.stderr = out
    def no_input(prompt=""):
        raise RuntimeError("ask only works inside a program. Put it in a section and press Run.")
    builtins.input = no_input
    err = None
    sys.settrace(_pb_guard())
    try:
        tree = ast.parse(src, "<terminal>", "exec")
        last = None
        if tree.body and isinstance(tree.body[-1], ast.Expr):
            last = ast.Expression(tree.body.pop().value)
        exec(compile(tree, "<terminal>", "exec"), _pb_ns)
        if last is not None:
            v = eval(compile(last, "<terminal>", "eval"), _pb_ns)
            if v is not None:
                print(repr(v))
    except _PBTooLong:
        err = {"type": "TooLong", "msg": "Stopped after too many steps."}
    except BaseException as e:
        err = {"type": type(e).__name__, "msg": str(e)}
    finally:
        sys.settrace(None)
        sys.stdout, sys.stderr, builtins.input = saved
    return json.dumps({"out": out.getvalue(), "error": err})

def _pb_reset():
    _pb_ns.clear()
    _pb_ns["__name__"] = "__terminal__"
`;

  let py = null;
  let loading = null;
  let fns = null;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src; s.async = true;
      s.onload = resolve;
      s.onerror = () => reject(new Error('could not load ' + src));
      document.head.appendChild(s);
    });
  }

  /* The bundled engine (pyodide.asm.wasm, 10 MB) is stored as four parts because
   * hosted pages accept smaller uploads. While Pyodide starts, its request for the
   * engine is answered with the parts joined back together. */
  async function withJoinedEngine(base, start) {
    if (!base) return start();
    const nativeFetch = window.fetch;
    let manifest = null;
    try {
      const r = await nativeFetch(base + 'pyodide.asm.parts.json');
      if (r.ok) manifest = await r.json();
    } catch (_) { manifest = null; }
    if (!manifest) return start();
    const joined = Promise.all(manifest.parts.map(async (p) => {
      const r = await nativeFetch(base + p);
      if (!r.ok) throw new Error('missing engine part ' + p);
      return r.arrayBuffer();
    })).then(bufs => new Blob(bufs, { type: 'application/wasm' }));
    window.fetch = function (input, init) {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input && input.url) || String(input);
      if (/\/pyodide\.asm\.wasm(\?|$)/.test(url)) {
        return joined.then(b => new Response(b, { status: 200, headers: { 'Content-Type': 'application/wasm' } }));
      }
      return nativeFetch.apply(this, arguments);
    };
    try { return await start(); }
    finally { window.fetch = nativeFetch; }
  }

  async function boot(onStatus) {
    let lastErr;
    for (const base of SOURCES) {
      try {
        onStatus && onStatus('Loading Python (about 13 MB, first run only)…');
        const bundledHere = base === SOURCES[0];
        if (bundledHere) {
          // Only use the bundled copy if it is really there (tools/fetch_pyodide.py makes it).
          const present = await fetch(base + 'pyodide.asm.parts.json', { cache: 'no-store' }).then(r => r.ok).catch(() => false);
          if (!present) continue;
        }
        if (typeof window.loadPyodide !== 'function') await loadScript(base + 'pyodide.js');
        // The standard library is a zip file. Hosted artifacts don't serve .zip, so the
        // bundled copy has a .wasm suffix; the bytes are unchanged.
        const bundled = base === SOURCES[0];
        py = await withJoinedEngine(bundled ? base : null, () => window.loadPyodide({
          indexURL: base,
          stdLibURL: base + (bundled ? 'python_stdlib.zip.wasm' : 'python_stdlib.zip'),
          stdout: () => {}, stderr: () => {},
        }));
        py.runPython(DRIVER);
        fns = {
          run: py.globals.get('_pb_run'),
          repl: py.globals.get('_pb_repl'),
          write: py.globals.get('_pb_write'),
          reset: py.globals.get('_pb_reset'),
        };
        py.runPython('import sys; _pb_version = sys.version.split()[0]');
        return py.globals.get('_pb_version');
      } catch (e) {
        lastErr = e;
        try { delete window.loadPyodide; } catch (_) { window.loadPyodide = undefined; }
      }
    }
    throw lastErr || new Error('Python could not start');
  }

  /* The code reader (lang/python_reader.py) runs inside the same Python. */
  let reader = null;
  function ensureReader(onStatus) {
    if (!reader) {
      reader = (async () => {
        await Runner.ensure(onStatus);
        const r = await fetch(new URL('lang/python_reader.py', location.href).href);
        if (!r.ok) throw new Error('could not load the code reader');
        py.globals.set('_reader_src', await r.text());
        py.runPython('import types\n_reader = types.ModuleType("intuicode_reader")\nexec(compile(_reader_src, "python_reader.py", "exec"), _reader.__dict__)');
        const R = py.globals.get('_reader');
        return {
          analyze: (files) => JSON.parse(R.analyze_json(JSON.stringify(files))),
          analyzeProject: (files) => JSON.parse(R.analyze_project_json(JSON.stringify(files))),
          summarise: (src, a, b, path) => JSON.parse(R.summarise_json(src, a, b, path || '')),
          readZip: (bytes) => {
            py.globals.set('_zip_bytes', bytes);
            try { return JSON.parse(py.runPython('_reader.read_zip_json(_zip_bytes.to_py().tobytes())')); }
            finally { py.globals.delete('_zip_bytes'); }
          },
          toSentences: (src, forceRaw) => JSON.parse(R.to_sentences_json(src, JSON.stringify(forceRaw || []))),
          compare: (a, b) => JSON.parse(R.compare_json(a, b)),
        };
      })().catch((e) => { reader = null; throw e; });
    }
    return reader;
  }

  const Runner = {
    reader: ensureReader,
    get ready() { return !!fns; },
    ensure(onStatus) {
      if (!loading) loading = boot(onStatus).catch(e => { loading = null; throw e; });
      return loading;
    },
    writeFiles(files) {
      for (const [name, text] of Object.entries(files)) fns.write(name, text);
    },
    run(answers, seed, modules) {
      return JSON.parse(fns.run(JSON.stringify(answers), seed, JSON.stringify(modules)));
    },
    repl(src) { return JSON.parse(fns.repl(src)); },
    reset() { fns && fns.reset(); },
  };

  window.IntuiRunner = Runner;
})();

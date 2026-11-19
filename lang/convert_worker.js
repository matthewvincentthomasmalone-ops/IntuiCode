/* IntuaCode — code turned into sentences away from the page (a Web Worker), so a big import doesn't hold the window up.
 *
 * The page posts { id, kind, source, base } (kind as IntuiConvert.toSentences takes it; base: where IntuaCode is, the
 * page's own address) and gets back { id, ok: true, r: { ok, text, exact, reason } }, or { id, ok: false, fatal, reason }
 * (fatal: the worker couldn't start, so the page turns the rest into sentences itself). The same files as the page's do
 * it, loaded here: the writers (the check), tree-sitter and its grammars (vendor/tree-sitter), and lang/convert.js.
 */
/* global importScripts */
'use strict';
let ready = null;
function start(base) {
  if (ready) return ready;
  ready = (async () => {
    const lang = (f) => base + 'lang/' + f;
    // (the lang files hang their objects on window, which is this worker while they load; tree-sitter's loader, after,
    // must find no window, or it takes this for a page)
    self.window = self;
    importScripts(lang('languages.js'), lang('python.js'), lang('web_write.js'), lang('ts_write.js'), lang('cpp_write.js'), lang('ts_patch.js'), lang('web_read.js'), lang('ts_convert.js'), lang('convert.js'));
    delete self.window;
    const rt = base + 'vendor/tree-sitter/';
    if (typeof self.TreeSitter === 'undefined') {
      // (as the page does it: loaded as text, so the fix for unknown HTML tags in lang/ts_patch.js goes in)
      const r = await fetch(rt + 'tree-sitter.js');
      if (!r.ok) throw new Error('tree-sitter.js: ' + r.status);
      const text = await r.text();
      try { self.TreeSitter = new Function(self.IntuiTsPatch.patch(text) + '\n;return TreeSitter;')(); }
      catch (e) { importScripts(rt + 'tree-sitter.js'); }
    }
    await self.IntuiWebReader.init({ TreeSitter: self.TreeSitter, locate: (f) => rt + f, only: ['js', 'ts', 'tsx', 'html', 'css'] });
    await self.IntuiWebReader.loadLangs(['html', 'css', 'js', 'ts', 'tsx', 'cpp']);
    return { parse: self.IntuiWebReader.parse, WEB: self.IntuiWeb, CPP: self.IntuiCpp, TS: self.IntuiTs };
  })();
  return ready;
}
self.onmessage = async (e) => {
  const { id, kind, source, base } = e.data || {};
  let env;
  try { env = await start(base); }
  catch (err) { self.postMessage({ id, ok: false, fatal: true, reason: String((err && err.message) || err) }); return; }
  try {
    const r = self.IntuiConvert.toSentences(kind, source, env);
    self.postMessage({ id, ok: true, r: { ok: !!r.ok, text: r.text, exact: r.exact, reason: r.reason || r.error || null } });
  } catch (err) {
    self.postMessage({ id, ok: true, r: { ok: false, reason: String((err && err.message) || err) } });
  }
};

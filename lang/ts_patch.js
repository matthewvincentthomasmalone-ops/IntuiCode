/* IntuCode — a fix for the tree-sitter runtime (web-tree-sitter 0.20.8).
 *
 * Its runtime doesn't include a few C library functions that the HTML grammar's scanner
 * calls for tags it doesn't know (inline SVG, custom elements), so reading such pages
 * crashed. patch(source) adds them: strncpy is missing entirely, and the wide-character
 * helpers fall back to JavaScript. Used when loading the runtime in the app and in tests,
 * and when bundling it (npm run vendor).
 */
(function (root) {
  'use strict';
  const FALLBACK = {
    towupper: 'function(c){var s=String.fromCodePoint(c).toUpperCase();return s.length===1?s.codePointAt(0):c}',
    towlower: 'function(c){var s=String.fromCodePoint(c).toLowerCase();return s.length===1?s.codePointAt(0):c}',
    iswalnum: 'function(c){return /[\\p{L}\\p{N}]/u.test(String.fromCodePoint(c))?1:0}',
    iswalpha: 'function(c){return /\\p{L}/u.test(String.fromCodePoint(c))?1:0}',
    iswspace: 'function(c){return /\\s/.test(String.fromCodePoint(c))?1:0}',
    iswdigit: 'function(c){return c>=48&&c<=57?1:0}',
  };
  const STRNCPY = ',_ic_strncpy=Module._strncpy=function(d,s,n){var i=0;for(;i<n;i++){var c=HEAPU8[s+i];HEAPU8[d+i]=c;if(!c)break}for(;i<n;i++)HEAPU8[d+i]=0;return d}';

  function patch(source) {
    if (source.includes('_ic_strncpy')) return source;
    const anchor = source.match(/_towupper=Module\._towupper=function\(\)\{[^}]*\}/);
    if (!anchor) throw new Error('The tree-sitter runtime has changed; the fix for unknown HTML tags does not apply.');
    const at = anchor.index + anchor[0].length;
    return (source.slice(0, at) + STRNCPY + source.slice(at))
      .replace(/Module\.asm\.(towupper|towlower|iswalnum|iswalpha|iswspace|iswdigit)\)\.apply/g, (m, f) => `(Module.asm.${f}||${FALLBACK[f]})).apply`);
  }

  const api = { patch };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.IntuiTsPatch = api;
})(typeof window !== 'undefined' ? window : globalThis);

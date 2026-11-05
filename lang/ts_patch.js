/* IntuaCode — a fix for the tree-sitter runtime (web-tree-sitter 0.20.8).
 *
 * Its runtime doesn't include a few C library functions that the HTML grammar's scanner
 * calls for tags it doesn't know (inline SVG, custom elements), so reading such pages
 * crashed. patch(source) adds them: strncpy is missing entirely, and the wide-character
 * helpers fall back to JavaScript. Used when loading the runtime in the app and in tests,
 * and when bundling it (npm run vendor).
 *
 * Other grammars' scanners call a few more that are missing (Ruby: iswupper; PHP: iswxdigit;
 * Bash and Vue: isalpha, strcmp; YAML and Elm: a C++ length check; most: assert), so those
 * are added too.
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
  const STRNCPY = ',_ic_strncpy=Module._strncpy=function(d,s,n){var i=0;for(;i<n;i++){var c=HEAPU8[s+i];HEAPU8[d+i]=c;if(!c)break}for(;i<n;i++)HEAPU8[d+i]=0;return d}'
    + ',_ic_strcmp=Module._strcmp=function(a,b){for(;;){var x=HEAPU8[a++],y=HEAPU8[b++];if(x!==y||!x)return x-y}}'
    + ',_ic_isalpha=Module._isalpha=function(c){return c>=65&&c<=90||c>=97&&c<=122?1:0}'
    + ',_ic_iswupper=Module._iswupper=function(c){if(c<0||c>1114111)return 0;var s=String.fromCodePoint(c);return s!==s.toLowerCase()?1:0}'
    + ',_ic_iswxdigit=Module._iswxdigit=function(c){return c>=48&&c<=57||c>=65&&c<=70||c>=97&&c<=102?1:0}'
    + ',_ic_assert=Module.___assert_fail=function(){throw new Error("A grammar\'s scanner failed a check")}'
    + ',_ic_length=Module.__ZNKSt3__220__vector_base_commonILb1EE20__throw_length_errorEv=function(){throw new Error("A grammar\'s scanner ran out of room")}';

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

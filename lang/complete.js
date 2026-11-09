/* IntuaCode — Predictive Mode for code: the rest of the word being typed, in any language IntuaCode knows.
 *
 * Sentences are predicted from sentences (lang/predict.js, lang/intent.js); code is predicted from what each
 * language is made of: its keywords and built-in functions, the libraries people use most with it, HTML's tags
 * and attributes (ARIA included), CSS's properties and values, and the common formats (JSON, YAML, TOML,
 * Markdown, CSV, SQL, shell). Names already in the file come first: they are what's most often typed next.
 *
 *   complete(lang, before, fileText, opts) -> { rest, word, label, kind } | null
 *        lang: a language id (lang/languages.js); before: the line up to the cursor; fileText: the whole file
 *        opts.glossary: window.IntuiGlossaryTerms, for each language's terms
 *   vocabulary(lang, glossary) -> [word] what's offered for a language, without the file's names
 *
 * No page here (no DOM): the app and the tests both use it.
 */
(function (root) {
  'use strict';

  const W = (s) => s.trim().split(/\s+/);
  const HTML_TAGS = W(`a abbr address article aside audio b blockquote body br button canvas caption code col colgroup data datalist dd
    details dialog div dl dt em fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 head header hgroup hr html i iframe img input ins
    kbd label legend li link main mark menu meta meter nav noscript object ol optgroup option output p picture pre progress q s samp script
    search section select slot small source span strong style sub summary sup table tbody td template textarea tfoot th thead time title tr
    track u ul var video wbr svg g defs symbol use path circle ellipse line polyline polygon rect text tspan linearGradient radialGradient
    stop pattern clipPath mask filter image foreignObject`);
  const HTML_ATTRS = W(`id class style title lang dir hidden tabindex href target rel download src srcset sizes alt width height loading
    decoding type name value placeholder required disabled readonly checked selected multiple min max step pattern maxlength minlength
    autocomplete autofocus for form action method enctype novalidate accept controls autoplay loop muted poster preload colspan rowspan
    headers scope datetime open content charset http-equiv role aria-label aria-labelledby aria-describedby aria-hidden aria-expanded
    aria-controls aria-current aria-live aria-pressed aria-selected aria-checked aria-disabled aria-haspopup aria-modal aria-valuenow
    aria-valuemin aria-valuemax data- onclick viewBox xmlns fill stroke stroke-width stroke-linecap stroke-linejoin opacity d cx cy r rx
    ry x y x1 y1 x2 y2 points transform offset stop-color stop-opacity gradientUnits patternUnits preserveAspectRatio`);
  const CSS_PROPS = W(`align-content align-items align-self animation aspect-ratio backdrop-filter background background-color
    background-image background-position background-repeat background-size border border-bottom border-collapse border-color
    border-left border-radius border-right border-style border-top border-width bottom box-shadow box-sizing clip-path color column-gap
    columns content cursor display filter flex flex-basis flex-direction flex-grow flex-shrink flex-wrap float font font-family font-size
    font-style font-weight gap grid grid-area grid-column grid-row grid-template-areas grid-template-columns grid-template-rows height
    inset justify-content justify-items justify-self left letter-spacing line-height list-style margin margin-bottom margin-left
    margin-right margin-top max-height max-width min-height min-width object-fit opacity order outline outline-offset overflow overflow-x
    overflow-y padding padding-bottom padding-left padding-right padding-top place-items pointer-events position right row-gap scroll-behavior
    text-align text-decoration text-overflow text-shadow text-transform top transform transition user-select vertical-align visibility
    white-space width word-break z-index`);
  const CSS_VALUES = W(`auto none inherit initial block inline inline-block flex inline-flex grid inline-grid contents hidden visible scroll
    absolute relative fixed sticky static center flex-start flex-end space-between space-around space-evenly stretch baseline row column
    wrap nowrap bold normal italic uppercase lowercase capitalize underline pointer default solid dashed dotted double transparent
    currentColor cover contain repeat no-repeat ease ease-in ease-out ease-in-out linear infinite alternate forwards both important
    rgba hsl var calc min max clamp minmax repeat`);
  const JS = W(`async await break case catch class const continue debugger default delete do else export extends false finally for function
    if import in instanceof let new null of return static super switch this throw true try typeof undefined var void while yield
    document window console.log console.error console.warn localStorage sessionStorage JSON.parse JSON.stringify Math.random Math.floor
    Math.round Math.ceil Math.min Math.max Math.abs Number parseInt parseFloat String Array Array.from Object.keys Object.values Object.entries
    Promise fetch setTimeout setInterval clearTimeout clearInterval requestAnimationFrame addEventListener removeEventListener
    querySelector querySelectorAll getElementById createElement appendChild append prepend remove classList.add classList.remove
    classList.toggle classList.contains textContent innerHTML innerText value checked disabled style dataset setAttribute getAttribute
    preventDefault stopPropagation target length push pop shift unshift slice splice map filter reduce forEach find findIndex some every
    includes indexOf join split trim toUpperCase toLowerCase replace replaceAll startsWith endsWith padStart toFixed getContext fillRect
    fillStyle strokeStyle beginPath arc fill stroke moveTo lineTo fillText drawImage clearRect`);
  const TS = W(`interface type enum implements private public protected readonly abstract declare namespace keyof unknown never any
    string number boolean void as satisfies`);
  const PY = W(`False None True and as assert async await break class continue def del elif else except finally for from global if import
    in is lambda nonlocal not or pass raise return try while with yield print input len range enumerate zip sorted reversed sum min max abs
    round int float str bool list dict set tuple open isinstance type super self __init__ __name__ __main__ append extend insert remove pop
    clear index count sort split join strip lower upper replace startswith endswith format items keys values get update random.randint
    random.choice random.shuffle random.random math.sqrt math.floor math.ceil math.pi time.sleep time.time datetime.now datetime.date
    json.load json.loads json.dump json.dumps os.path.join os.listdir os.environ pathlib.Path sys.argv sys.exit re.match re.search
    re.findall re.sub csv.reader csv.writer csv.DictReader requests.get requests.post flask Flask request jsonify render_template
    tkinter tk.Tk tk.Label tk.Button tk.Entry tk.Canvas mainloop pack grid place config pygame dataclass field Exception ValueError
    KeyError TypeError IndexError FileNotFoundError`);
  const CPP = W(`auto bool break case catch char class const constexpr continue default delete do double else enum explicit false float for
    friend if inline int long namespace new nullptr operator private protected public return short signed sizeof static struct switch
    template this throw true try typedef typename union unsigned using virtual void volatile while #include #define std::cout std::cin
    std::endl std::string std::vector std::map std::array std::to_string std::sort std::max std::min std::abs std::sqrt std::pow push_back
    size begin end empty clear at front back insert erase find`);
  const ARDUINO = W(`setup loop pinMode digitalWrite digitalRead analogRead analogWrite delay delayMicroseconds millis micros map
    constrain random randomSeed tone noTone pulseIn attachInterrupt detachInterrupt Serial.begin Serial.print Serial.println
    Serial.available Serial.read Serial.write Serial.printf HIGH LOW INPUT OUTPUT INPUT_PULLUP LED_BUILTIN A0 A1 A2 A3 A4 A5 byte
    boolean String Wire.begin Wire.write Wire.read Servo attach write LiquidCrystal lcd.begin lcd.print lcd.setCursor lcd.clear`);
  const SQL = W(`SELECT FROM WHERE AND OR NOT NULL IS IN LIKE BETWEEN ORDER BY GROUP HAVING LIMIT OFFSET INSERT INTO VALUES UPDATE SET DELETE
    CREATE TABLE ALTER DROP INDEX PRIMARY KEY FOREIGN REFERENCES UNIQUE DEFAULT JOIN LEFT RIGHT INNER OUTER ON AS DISTINCT COUNT SUM AVG
    MIN MAX INTEGER TEXT REAL BLOB VARCHAR BOOLEAN DATE TIMESTAMP AUTOINCREMENT CASCADE`);
  const SHELL = W(`echo cd ls pwd mkdir rm cp mv cat grep find chmod chown export source sudo apt git npm npx node python python3 pip
    curl wget tar zip unzip if then else fi for do done while case esac function return exit`);
  const OTHER = {
    rust: W('fn let mut const struct enum impl trait pub use mod match if else loop while for in return self Self String Vec Option Some None Result Ok Err println! format! vec! unwrap expect clone'),
    go: W('package import func var const type struct interface map chan go defer return if else for range switch case select fmt.Println fmt.Printf make append len nil err error string int bool'),
    java: W('public private protected class interface extends implements static final void int boolean String new return if else for while switch case try catch throw import package System.out.println ArrayList HashMap List Map'),
    csharp: W('using namespace public private protected class interface static void int bool string var new return if else for foreach while switch case try catch throw Console.WriteLine List Dictionary async await'),
    php: W('echo function return if else elseif foreach as while class public private protected new array isset empty require include $_GET $_POST'),
    ruby: W('def end class module if elsif else unless while until do puts require attr_accessor return nil true false each map select'),
    kotlin: W('fun val var class object data if else when for while return println listOf mapOf null'),
    swift: W('func let var class struct enum protocol extension if else guard switch case for in while return print nil self import'),
    lua: W('local function end if then else elseif for in do while return nil true false print require pairs ipairs'),
    dart: W('void main var final const class extends return if else for while print Widget StatelessWidget StatefulWidget build setState'),
    json: W('true false null'),
    yaml: W('true false null'),
    toml: W('true false'),
  };
  const BY_LANG = { html: HTML_TAGS.concat(HTML_ATTRS), css: CSS_PROPS.concat(CSS_VALUES), js: JS, ts: JS.concat(TS), tsx: JS.concat(TS), vue: JS.concat(HTML_TAGS),
    python: PY, cpp: CPP, arduino: ARDUINO.concat(CPP), c: CPP, sql: SQL, bash: SHELL };

  /* What a language offers, from the lists here and the glossary's terms for it. */
  const vocabCache = new Map();
  function vocabulary(lang, glossary) {
    const key = lang + (glossary ? '+g' : '');
    if (vocabCache.has(key)) return vocabCache.get(key);
    const out = new Set(BY_LANG[lang] || OTHER[lang] || []);
    const g = glossary && (glossary[lang === 'arduino' ? 'arduino' : lang === 'ts' || lang === 'tsx' ? 'js' : lang] || []);
    for (const e of g || []) for (const m of e.m || [e.t]) {
      const w = String(m).replace(/^<|>$|[=:(]+$/g, '').trim();
      if (/^[#$@A-Za-z_][\w.:$-]*$/.test(w) && w.length > 1) out.add(w);
    }
    const list = [...out];
    vocabCache.set(key, list);
    return list;
  }

  /* The word being typed: what the language counts as one (dots and :: join names; HTML and CSS take dashes). */
  const WORD = {
    html: /(<\/?)?([A-Za-z][\w-]*)$/, css: /([A-Za-z-][\w-]*)$/, sql: /([A-Za-z_]\w*)$/,
    cpp: /([#A-Za-z_][\w]*(?:(?:::|\.)[A-Za-z_]\w*)*(?:::|\.)?)$/, arduino: /([#A-Za-z_][\w]*(?:\.[A-Za-z_]\w*)*\.?)$/,
  };
  const wordAt = (lang, before) => {
    const m = before.match(WORD[lang] || /([$A-Za-z_][\w$]*(?:\.[A-Za-z_$][\w$]*)*\.?)$/);
    return m ? m[m.length - 1] : '';
  };

  function complete(lang, before, fileText, opts = {}) {
    const line = String(before || '');
    if (/^\s*(?:#|\/\/|--|<!--)/.test(line) && !/^\s*#(?:include|define)?\w*$/.test(line)) return null;   // inside a comment
    if ((line.match(/"/g) || []).length % 2 || (line.match(/'/g) || []).length % 2) return null;      // inside quoted text
    const word = wordAt(lang, line);
    if (word.length < 2 || /^\d/.test(word)) return null;
    // names already in the file, by how often they appear (the word being typed, as typed, left out)
    const counts = new Map();
    for (const w of String(fileText || '').match(/[#$A-Za-z_][\w$]*(?:(?:\.|::|-)[A-Za-z_$][\w$]*)*/g) || []) counts.set(w, (counts.get(w) || 0) + 1);
    if (counts.get(word) === 1) counts.delete(word);
    const own = [...counts.keys()].filter(w => w.length > word.length && w.startsWith(word)).sort((a, b) => counts.get(b) - counts.get(a) || a.length - b.length);
    const ci = lang === 'sql' || lang === 'html' || lang === 'css';
    const vocab = vocabulary(lang, opts.glossary);
    const known = (w) => vocab.filter(v => v.length > w.length && (ci ? v.toLowerCase().startsWith(w.toLowerCase()) : v.startsWith(w))).sort((a, b) => a.length - b.length);
    let typed = word, pick = own[0] || known(word)[0];
    if (!pick) {
      // after a dot (or ::), the member being typed: document.getEl -> getElementById
      const tail = word.split(/\.|::/).pop();
      if (tail.length >= 2 && tail !== word) { typed = tail; pick = known(tail)[0]; }
    }
    if (!pick) return null;
    let rest = pick.slice(typed.length);
    if (lang === 'sql' && typed === typed.toLowerCase()) rest = rest.toLowerCase();   // SQL typed in small letters: carry on in them
    // in HTML, an attribute gets its ="" (the cursor's spot inside it is the app's to set)
    if (lang === 'html' && HTML_ATTRS.includes(pick) && /<[A-Za-z][\w-]*\s[^>]*$/.test(line) && !/^data-$/.test(pick)) rest += '=""';
    if (lang === 'css' && CSS_PROPS.includes(pick) && !/:/.test(line.slice(line.lastIndexOf(';') + 1))) rest += ': ';
    return { rest, word: typed, label: pick, kind: own[0] ? 'name' : 'language' };
  }

  root.IntuiComplete = { complete, vocabulary };
})(typeof window !== 'undefined' ? window : globalThis);

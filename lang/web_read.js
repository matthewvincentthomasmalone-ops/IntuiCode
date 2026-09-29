/* IntuiCode — web reader: JavaScript / TypeScript / React, HTML and CSS.
 *
 * Same idea as the Python reader: split files into sections, describe each
 * in plain English with rules (no AI), flag things worth checking, and link
 * files across languages:
 *   HTML <script>/<link>      -> the JS and CSS files a page uses
 *   JS getElementById('x')    -> the HTML element with id="x"
 *   CSS .card                 -> the HTML elements it styles
 *   JS fetch('/api/tasks')    -> the Python or Express route that answers it
 *
 * Parsing uses tree-sitter. Works in the browser and in Node (for tests).
 * Text links use [[path]] and [[path#name]], like the Python reader.
 */
(function (root) {
  'use strict';

  const GRAMMARS = { js: 'javascript', ts: 'typescript', tsx: 'tsx', html: 'html', css: 'css', cpp: 'cpp' };
  let TS = null;           // the tree-sitter module
  const langs = {};        // loaded grammars

  const code = (s) => '`' + s + '`';
  function plainList(items, limit = 6) {
    items = [...items];
    if (!items.length) return '';
    const more = items.length - limit;
    items = items.slice(0, limit);
    const text = items.length === 1 ? items[0] : items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1];
    return text + (more > 0 ? ` (and ${more} more)` : '');
  }
  const add = (list, item) => { if (item && !list.includes(item)) list.push(item); };
  const unquote = (s) => s.replace(/^[`'"]|[`'"]$/g, '');

  /* ------------------------------------------------------------------ */
  /* Setup                                                               */
  /* ------------------------------------------------------------------ */

  // opts: { TreeSitter (module), locate(file) -> url or path }
  let OPTS = null;
  async function init(opts) {
    if (!TS) {
      TS = opts.TreeSitter;
      OPTS = opts;
      await TS.init({ locateFile: (f) => opts.locate(f) });
    }
    await loadLangs(opts.only || Object.keys(GRAMMARS));
  }
  /* Grammars load on demand (the C++ one is large). */
  async function loadLangs(kinds) {
    for (const key of kinds) if (GRAMMARS[key] && !langs[key]) langs[key] = await TS.Language.load(OPTS.locate(`tree-sitter-${GRAMMARS[key]}.wasm`));
  }

  function parse(kind, source) {
    const p = new TS();
    p.setLanguage(langs[kind]);
    return p.parse(source).rootNode;
  }

  function kindOfPath(path) {
    const ext = (path.match(/\.([a-z0-9]+)$/i) || [])[1] || '';
    return { js: 'js', jsx: 'js', mjs: 'js', cjs: 'js', ts: 'ts', mts: 'ts', tsx: 'tsx', html: 'html', htm: 'html', css: 'css',
      cpp: 'cpp', cc: 'cpp', cxx: 'cpp', hpp: 'cpp', h: 'cpp', hh: 'cpp', ino: 'cpp' }[ext.toLowerCase()] || null;
  }

  function* walk(node) {
    yield node;
    for (let i = 0; i < node.namedChildCount; i++) yield* walk(node.namedChild(i));
  }
  const field = (n, f) => n.childForFieldName(f);
  const line = (n) => n.startPosition.row + 1;
  const endLine = (n) => n.endPosition.row + 1;

  function commentAbove(lines, row) {
    const out = [];
    for (let i = row - 1; i >= 0; i--) {
      const t = lines[i].trim();
      if (/^(\/\/|\*|\/\*)/.test(t)) out.unshift(t.replace(/^\/\/+|^\/\*+|\*+\/$|^\*+/g, '').trim());
      else break;
    }
    return out.filter(x => x && !/^[-=*#~ ]+$/.test(x) && !/^@\w+/.test(x)).join(' ');
  }

  /* ------------------------------------------------------------------ */
  /* JavaScript / TypeScript / React                                     */
  /* ------------------------------------------------------------------ */

  const JS_LIBS = {
    react: 'builds user interfaces from components', 'react-dom': 'puts React components on the page', next: 'a React framework for full websites',
    vue: 'builds user interfaces', svelte: 'builds user interfaces', express: 'runs a web server', axios: 'talks to servers over the internet',
    'node-fetch': 'talks to servers over the internet', mongoose: 'talks to a MongoDB database', pg: 'talks to a PostgreSQL database',
    sqlite3: 'stores data in a database file', 'better-sqlite3': 'stores data in a database file', prisma: 'works with databases', '@prisma/client': 'works with databases',
    dotenv: 'loads secret settings from a .env file', jsonwebtoken: 'makes and checks login tokens', bcrypt: 'scrambles passwords safely', bcryptjs: 'scrambles passwords safely',
    cors: 'lets other websites call this server', 'socket.io': 'sends live messages between browser and server', ws: 'sends live messages over WebSockets',
    fs: 'reads and writes files', path: 'works with file paths', http: 'runs a basic web server', https: 'runs a secure web server', crypto: 'makes random values and fingerprints',
    openai: 'calls an AI model', '@anthropic-ai/sdk': 'calls an AI model', stripe: 'takes payments', lodash: 'provides helper functions',
    'date-fns': 'works with dates', dayjs: 'works with dates', zod: 'checks that data has the right shape', 'chart.js': 'draws charts', d3: 'draws charts and diagrams',
    three: 'draws 3D graphics', tailwindcss: 'styles pages with utility classes', vite: 'builds and serves the website while you work', jest: 'tests code', vitest: 'tests code',
    'react-router-dom': 'moves between pages in a React app', '@supabase/supabase-js': 'talks to a Supabase database', firebase: 'talks to Firebase services',
  };
  const NODE_BUILTINS = new Set(['fs', 'path', 'http', 'https', 'crypto', 'os', 'url', 'util', 'events', 'child_process', 'stream', 'zlib', 'net', 'readline', 'assert', 'process']);
  const SECRET = /(api_?key|secret|token|password|passwd|private_?key|access_?key|webhook)/i;
  const libPhrase = (l) => JS_LIBS[l] ? `${code(l)} (${JS_LIBS[l]})` : code(l);

  function importsOf(rootNode) {
    const out = [];   // {source, names[], line}
    for (const n of walk(rootNode)) {
      if (n.type === 'import_statement') {
        const src = field(n, 'source');
        const names = [];
        for (const c of walk(n)) if (c.type === 'identifier' && c.parent && /import_specifier|import_clause|namespace_import/.test(c.parent.type)) names.push(c.text);
        if (src) out.push({ source: unquote(src.text), names, line: line(n) });
      } else if (n.type === 'call_expression' && field(n, 'function') && field(n, 'function').text === 'require') {
        const arg = field(n, 'arguments') && field(n, 'arguments').namedChild(0);
        if (arg && arg.type === 'string') {
          let names = [];
          const decl = n.parent && n.parent.type === 'variable_declarator' ? n.parent : null;
          if (decl) { const nm = field(decl, 'name'); names = nm ? [...walk(nm)].filter(x => x.type === 'identifier' || x.type === 'shorthand_property_identifier_pattern').map(x => x.text) : []; }
          out.push({ source: unquote(arg.text), names, line: line(n) });
        }
      }
    }
    return out;
  }
  const pkgOf = (src) => src.startsWith('@') ? src.split('/').slice(0, 2).join('/') : src.replace(/^node:/, '').split('/')[0];

  function returnsJsx(fn) {
    for (const n of walk(fn)) if (n.type === 'jsx_element' || n.type === 'jsx_self_closing_element' || n.type === 'jsx_fragment') return true;
    return false;
  }

  function jsFacts(nodes, ctx) {
    const f = { effects: [], libs: [], warnings: [], dom: [], fetches: [], events: [], state: [], draws: [], calls: [], loops: 0, decisions: 0, returns: 0, handles: false, awaits: false };
    const localFns = ctx.localFns;
    for (const top of nodes) for (const n of walk(top)) {
      const t = n.type;
      if (/^(for|for_in|while|do)_statement$/.test(t)) f.loops++;
      else if (t === 'if_statement' || t === 'ternary_expression' || t === 'switch_statement') f.decisions++;
      else if (t === 'return_statement' && n.namedChildCount) f.returns++;
      else if (t === 'await_expression') f.awaits = true;
      else if (t === 'catch_clause') {
        f.handles = true;
        const body = field(n, 'body');
        if (body && body.namedChildCount === 0) add(f.warnings, 'Catches an error and does nothing with it, so problems can fail silently.');
      } else if (t === 'jsx_opening_element' || t === 'jsx_self_closing_element') {
        const nm = field(n, 'name');
        if (nm) add(f.draws, nm.text);
      } else if (t === 'assignment_expression') {
        const left = field(n, 'left'), right = field(n, 'right');
        if (left && /\.(innerHTML|outerHTML)$/.test(left.text)) {
          add(f.effects, 'changes what is shown on the page');
          if (right && !/^(['"])[^'"]*\1$/.test(right.text) && right.type !== 'string') add(f.warnings, `Puts text into ${code(left.text)}. If any of it comes from users, they could inject their own code (XSS); use textContent for plain text.`);
        } else if (left && /\.(textContent|innerText|value)$/.test(left.text)) add(f.effects, 'changes what is shown on the page');
        else if (left && /\.style\./.test(left.text)) add(f.effects, 'changes how something looks');
        else if (left && /^(window\.)?location(\.href)?$/.test(left.text)) add(f.effects, 'moves to another page');
      } else if (t === 'variable_declarator' || t === 'pair' || t === 'assignment_expression') {
        const nm = field(n, t === 'pair' ? 'key' : 'name') || field(n, 'left');
        const val = field(n, 'value') || field(n, 'right');
        if (nm && val && SECRET.test(nm.text) && val.type === 'string' && unquote(val.text).length >= 8)
          add(f.warnings, `${code(nm.text)} looks like a secret written straight into the code. Anyone who can see the code (including website visitors, for front-end code) can read it.`);
      } else if (t === 'string' || t === 'template_string') {
        if (/^['"`]http:\/\/(?!localhost|127\.0\.0\.1)/.test(n.text)) add(f.warnings, `Uses ${code(unquote(n.text).slice(0, 60))}, which is not encrypted (http, not https).`);
      } else if (t === 'call_expression') {
        const fn = field(n, 'function');
        if (!fn) continue;
        const name = fn.text;
        const args = field(n, 'arguments');
        const first = args && args.namedChild(0);
        const firstStr = first && (first.type === 'string' || first.type === 'template_string') ? unquote(first.text) : null;
        const root = name.split(/[.(]/)[0];
        if (ctx.libOf[root]) add(f.libs, ctx.libOf[root]);
        if (ctx.xnames[name]) { add(f.calls, `[[${ctx.xnames[name]}#${name}]]`); ctx.uses.push([ctx.path, ctx.xnames[name], name]); }
        else if (localFns.has(name)) add(f.calls, code(name));
        if (/^document\.(getElementById|querySelector(All)?|getElementsByClassName|getElementsByTagName)$/.test(name) && firstStr) {
          const sel = name.endsWith('getElementById') ? '#' + firstStr : name.endsWith('ClassName') ? '.' + firstStr : firstStr;
          add(f.dom, sel);
        } else if (/\.createElement$/.test(name)) add(f.effects, 'adds new things to the page');
        else if (/\.(appendChild|append|prepend|insertAdjacentHTML|replaceChildren|remove|removeChild)$/.test(name)) {
          add(f.effects, 'changes what is on the page');
          if (/insertAdjacentHTML$/.test(name)) add(f.warnings, 'Uses insertAdjacentHTML. If the text comes from users, they could inject their own code (XSS).');
        } else if (/\.addEventListener$/.test(name) && firstStr) {
          const target = name.replace(/\.addEventListener$/, '');
          add(f.events, `${firstStr} on ${code(target)}`);
        } else if (name === 'fetch' || /^axios(\.(get|post|put|delete|patch))?$/.test(name) || /^(\$|jQuery)\.(ajax|get|post)$/.test(name)) {
          let method = (name.match(/\.(get|post|put|delete|patch)$/) || [])[1];
          if (!method && args) { const opt = args.namedChild(1); const m = opt && opt.text.match(/method\s*:\s*['"`](\w+)/i); method = m ? m[1] : 'get'; }
          const constUrl = first && first.type === 'identifier' && ctx.consts && ctx.consts[first.text];
          const url = constUrl || (first ? (first.type === 'string' ? unquote(first.text) : first.type === 'template_string' ? unquote(first.text).replace(/\$\{[^}]*\}/g, '{…}') : first.text) : '?');
          f.fetches.push({ method: (method || 'get').toUpperCase(), url, line: line(n), dynamic: !(constUrl || (first && (first.type === 'string' || first.type === 'template_string'))) });
        } else if (/^(localStorage|sessionStorage)\.(setItem|getItem|removeItem)$/.test(name)) add(f.effects, name.endsWith('getItem') ? 'reads data saved in the browser' : 'saves data in the browser');
        else if (name === 'setTimeout') add(f.effects, 'runs something after a delay');
        else if (name === 'setInterval') add(f.effects, 'runs something again and again on a timer');
        else if (/^console\.(log|debug|info)$/.test(name)) add(f.effects, 'writes messages to the developer console');
        else if (/^(window\.)?(alert|confirm|prompt)$/.test(name)) add(f.effects, 'shows a pop-up message');
        else if (name === 'eval' || name === 'Function' || name === 'document.write') add(f.warnings, `Uses ${code(name)}, which runs or writes raw text as code. That is risky if the text comes from users.`);
        else if (/^use(State|Reducer)$/.test(name)) {
          const decl = n.parent && n.parent.type === 'variable_declarator' ? field(n.parent, 'name') : null;
          const first2 = decl && decl.namedChild(0);
          add(f.state, first2 ? first2.text : 'a value');
        } else if (name === 'useEffect') add(f.effects, 'runs extra work after the component appears or changes');
        else if (/^(fs\.)?(readFile|readFileSync|writeFile|writeFileSync|appendFile)/.test(name.replace(/^fs\.promises\./, 'fs.'))) add(f.effects, /write|append/i.test(name) ? 'writes to a file' : 'reads a file');
        else if (/\.(query|execute|find|findOne|insertOne|updateOne|deleteOne|findMany|create|update|delete)$/.test(name) && /(db|pool|client|prisma|model|collection|knex|sql)/i.test(name)) {
          add(f.effects, 'reads or changes a database');
          if (first && first.type === 'template_string' && /\$\{/.test(first.text) && /select|insert|update|delete/i.test(first.text)) add(f.warnings, 'Builds a database query by joining text. If any of it comes from users, this allows SQL injection; pass values separately.');
        } else if (/^res\.(send|json|render|status|redirect)$/.test(name)) add(f.effects, 'sends a reply to the browser');
      }
    }
    return f;
  }

  function jsStepLines(nodes, src, depth = 0, limit = 16) {
    const out = [];
    const pad = (d) => '    '.repeat(d);
    const text = (n) => n.text.replace(/\s+/g, ' ');
    const expr = (n) => {
      if (!n) return '';
      if (n.type === 'binary_expression') {
        const op = n.child(1).type;
        const w = { '===': 'is', '==': 'is', '!==': 'is not', '!=': 'is not', '>': 'is more than', '<': 'is less than', '>=': 'is at least', '<=': 'is at most', '&&': 'and', '||': 'or', '+': 'plus', '-': 'minus', '*': 'times', '/': 'divided by' }[op];
        if (w) return `${expr(field(n, 'left'))} ${w} ${expr(field(n, 'right'))}`;
      }
      if (n.type === 'unary_expression' && n.child(0).type === '!') return `not ${expr(n.namedChild(0))}`;
      if (n.type === 'member_expression' && /\.length$/.test(n.text) && field(n, 'object')) return `length of ${expr(field(n, 'object'))}`;
      if (n.type === 'await_expression') return `wait for ${expr(n.namedChild(0))}`;
      if (n.type === 'true') return 'yes';
      if (n.type === 'false') return 'no';
      if (n.type === 'null' || n.type === 'undefined') return 'nothing';
      return text(n).length > 70 ? text(n).slice(0, 67) + '…' : text(n);
    };
    const visit = (n, d) => {
      if (out.length > limit) return;
      const t = n.type;
      if (t === 'comment') { out.push(pad(d) + 'note: ' + n.text.replace(/^\/\/\s?|^\/\*+|\*+\/$/g, '').trim().slice(0, 80)); return; }
      if (t === 'lexical_declaration' || t === 'variable_declaration') {
        for (const decl of n.namedChildren.filter(c => c.type === 'variable_declarator')) {
          const nm = field(decl, 'name'), v = field(decl, 'value');
          if (v && (v.type === 'arrow_function' || v.type === 'function' || v.type === 'function_expression')) { out.push(pad(d) + `define ${nm.text}` + params(v)); const b = field(v, 'body'); if (b && b.type === 'statement_block') block(b, d + 1); else if (b) out.push(pad(d + 1) + `give back ${expr(b)}`); }
          else out.push(pad(d) + (v ? `set ${nm.text} to ${expr(v)}` : `create ${nm.text}`));
        }
        return;
      }
      if (t === 'function_declaration') { out.push(pad(d) + `define ${text(field(n, 'name'))}` + params(n)); block(field(n, 'body'), d + 1); return; }
      if (t === 'expression_statement') {
        const e = n.namedChild(0);
        if (e && e.type === 'call_expression') {
          const fn = field(e, 'function').text, args = field(e, 'arguments');
          if (/^console\.log$/.test(fn)) { out.push(pad(d) + 'show ' + args.namedChildren.map(expr).join(' and ')); return; }
          if (/\.addEventListener$/.test(fn) && args.namedChildCount >= 2) {
            const ev = unquote(args.namedChild(0).text), h = args.namedChild(1);
            out.push(pad(d) + `when ${fn.replace(/\.addEventListener$/, '')} gets "${ev}"`);
            if (h.type === 'arrow_function' || h.type === 'function' || h.type === 'function_expression') { const b = field(h, 'body'); if (b && b.type === 'statement_block') block(b, d + 1); else out.push(pad(d + 1) + expr(b)); }
            else out.push(pad(d + 1) + `run ${h.text}`);
            return;
          }
          out.push(pad(d) + `run ${fn}` + (args.namedChildCount ? ' with ' + args.namedChildren.map(expr).join(', ') : ''));
          return;
        }
        if (e && e.type === 'assignment_expression') { out.push(pad(d) + `set ${text(field(e, 'left'))} to ${expr(field(e, 'right'))}`); return; }
        if (e && e.type === 'augmented_assignment_expression') { out.push(pad(d) + `${e.child(1).type === '+=' ? 'increase' : 'change'} ${text(field(e, 'left'))} by ${expr(field(e, 'right'))}`); return; }
        if (e && e.type === 'update_expression') { out.push(pad(d) + `${/\+\+/.test(e.text) ? 'increase' : 'decrease'} ${e.text.replace(/\+\+|--/g, '')} by 1`); return; }
      }
      if (t === 'if_statement') {
        out.push(pad(d) + `if ${expr(field(n, 'condition').namedChild(0) || field(n, 'condition'))}`);
        const c = field(n, 'consequence'); c.type === 'statement_block' ? block(c, d + 1) : visit(c, d + 1);
        const alt = field(n, 'alternative');
        if (alt) { const inner = alt.namedChild(0); if (inner && inner.type === 'if_statement') { out.push(pad(d) + 'otherwise…'); visit(inner, d + 1); } else { out.push(pad(d) + 'otherwise'); inner && inner.type === 'statement_block' ? block(inner, d + 1) : inner && visit(inner, d + 1); } }
        return;
      }
      if (t === 'for_in_statement') { out.push(pad(d) + `for each ${text(field(n, 'left'))} in ${expr(field(n, 'right'))}`); block(field(n, 'body'), d + 1); return; }
      if (t === 'while_statement') { out.push(pad(d) + `while ${expr(field(n, 'condition').namedChild(0) || field(n, 'condition'))}`); block(field(n, 'body'), d + 1); return; }
      if (t === 'return_statement') { out.push(pad(d) + 'give back' + (n.namedChildCount ? ' ' + expr(n.namedChild(0)) : '')); return; }
      if (t === 'try_statement') { out.push(pad(d) + 'try'); block(field(n, 'body'), d + 1); const h = field(n, 'handler'); if (h) { out.push(pad(d) + 'if it fails'); block(field(h, 'body'), d + 1); } return; }
      if (t === 'throw_statement') { out.push(pad(d) + `fail with ${expr(n.namedChild(0))}`); return; }
      out.push(pad(d) + 'js: ' + (text(n).length > 80 ? text(n).slice(0, 77) + '…' : text(n)));
    };
    const params = (fn) => { const p = field(fn, 'parameters') || field(fn, 'parameter'); const s = p ? p.text.replace(/^\(|\)$/g, '').trim() : ''; return s ? ` using ${s}` : ''; };
    const block = (b, d) => { if (!b) return; for (const c of b.namedChildren) visit(c, d); };
    for (const n of nodes) visit(n, depth);
    return { steps: out.slice(0, limit), more: out.length > limit };
  }

  function expressRoute(n) {
    // app.get('/path', handler)  router.post(...)
    if (n.type !== 'expression_statement') return null;
    const e = n.namedChild(0);
    if (!e || e.type !== 'call_expression') return null;
    const fn = field(e, 'function');
    const m = fn && fn.text.match(/^(\w+)\.(get|post|put|delete|patch|all)$/);
    const args = field(e, 'arguments');
    const first = args && args.namedChild(0);
    if (!m || !first || first.type !== 'string' || !/^(app|router|server|api|\w*Router|\w*router)$/.test(m[1])) return null;
    return { method: m[2].toUpperCase(), path: unquote(first.text), obj: m[1] };
  }

  function analyzeJs(path, source, kind, ctx) {
    const rootNode = parse(kind, source);
    const lines = source.split('\n');
    const imps = importsOf(rootNode);
    ctx.libOf = {};
    for (const imp of imps) for (const nm of imp.names) if (!imp.source.startsWith('.')) ctx.libOf[nm] = pkgOf(imp.source);
    ctx.localFns = new Set();
    ctx.consts = {};
    for (const n0 of rootNode.namedChildren) {
      const n = n0.type === 'export_statement' ? n0.namedChild(0) || n0 : n0;
      if (n.type === 'lexical_declaration' || n.type === 'variable_declaration')
        for (const d of n.namedChildren.filter(c => c.type === 'variable_declarator')) {
          const v = field(d, 'value');
          if (v && v.type === 'string') ctx.consts[field(d, 'name').text] = unquote(v.text);
        }
    }
    const sections = [];
    const groups = [];
    const push = (kind2, node, extra) => {
      const last = groups[groups.length - 1];
      if (last && last.kind === kind2 && ['imports', 'settings', 'steps'].includes(kind2)) last.nodes.push(node);
      else groups.push({ kind: kind2, nodes: [node], ...(extra || {}) });
    };
    // classify top-level statements
    for (const n0 of rootNode.namedChildren) {
      let n = n0;
      if (n.type === 'comment') continue;
      if (n.type === 'export_statement') n = n.namedChildren.find(c => c.type !== 'comment' && c.type !== 'decorator') || n;
      const t = n.type;
      if (t === 'import_statement' || (t === 'lexical_declaration' || t === 'variable_declaration') && /require\(/.test(n.text) && n.namedChildren.every(c => /require\(/.test(c.text) || c.type !== 'variable_declarator')) { push('imports', n0); continue; }
      if (t === 'function_declaration' || t === 'generator_function_declaration') {
        const name = field(n, 'name') ? field(n, 'name').text : 'function';
        ctx.localFns.add(name);
        push(returnsJsx(n) && /^[A-Z]/.test(name) ? 'component' : 'tool', n0, { name, fn: n });
        continue;
      }
      if (t === 'class_declaration') { push('class', n0, { name: field(n, 'name').text, fn: n }); continue; }
      if (t === 'lexical_declaration' || t === 'variable_declaration') {
        const decls = n.namedChildren.filter(c => c.type === 'variable_declarator');
        const fnDecl = decls.length === 1 && field(decls[0], 'value') && /^(arrow_function|function|function_expression)$/.test(field(decls[0], 'value').type) ? decls[0] : null;
        if (fnDecl) {
          const name = field(fnDecl, 'name').text;
          ctx.localFns.add(name);
          push(returnsJsx(fnDecl) && /^[A-Z]/.test(name) ? 'component' : 'tool', n0, { name, fn: field(fnDecl, 'value') });
          continue;
        }
        const plain = decls.every(dd => { const v = field(dd, 'value'); return !v || /^(string|number|true|false|null|template_string|array|object|regex)$/.test(v.type) && !/\(/.test(v.text.replace(/(['"`]).*?\1/g, '')); });
        push(plain ? 'settings' : 'steps', n0);
        continue;
      }
      const route = expressRoute(n);
      if (route) { push('route', n0, route); continue; }
      if (t === 'expression_statement' && /\.addEventListener\(/.test(n.text.split('\n')[0])) { push('handler', n0); continue; }
      push('steps', n0);
    }
    const KIND_TITLE = { imports: 'Toolkits used', settings: 'Settings', steps: 'Main steps', handler: 'Reacts to', tool: 'Tool', component: 'Component', class: 'Class', route: 'Web route' };
    let id = 0;
    for (const g of groups) {
      const first = g.nodes[0];
      const start = (() => { let s = line(first); while (s > 1 && /^\s*(\/\/|\*|\/\*)/.test(lines[s - 2])) s--; return s; })();
      const end = endLine(g.nodes[g.nodes.length - 1]);
      const note = commentAbove(lines, line(first) - 1);
      const facts = [];
      let title = KIND_TITLE[g.kind], headline = '';
      const F = jsFacts(g.nodes, { ...ctx, path });
      if (g.kind === 'imports') {
        const srcs = [];
        for (const nn of g.nodes) for (const imp of importsOf(nn)) add(srcs, imp.source);
        headline = `Brings in ${srcs.length} toolkit${srcs.length === 1 ? '' : 's'} or file${srcs.length === 1 ? '' : 's'}.`;
        for (const s of srcs) facts.push(s.startsWith('.') ? (ctx.fileOf(s) ? `[[${ctx.fileOf(s)}]] (another file in this project)` : `${code(s)} (a file in this project)`) : libPhrase(pkgOf(s)));
      } else if (g.kind === 'settings') {
        const names = g.nodes.flatMap(nn => { const d = nn.type === 'export_statement' ? nn.namedChild(0) : nn; return d.namedChildren.filter(c => c.type === 'variable_declarator').map(c => field(c, 'name').text); });
        headline = `Sets ${names.length} starting value${names.length === 1 ? '' : 's'}: ${plainList(names.map(code))}.`;
      } else if (g.kind === 'tool' || g.kind === 'component' || g.kind === 'class') {
        const fn = g.fn;
        const p = field(fn, 'parameters') || field(fn, 'parameter');
        const params = p ? p.text.replace(/^\(|\)$/g, '').split(',').map(x => x.trim()).filter(Boolean) : [];
        const isAsync = /^async\b/.test(fn.text) || (fn.parent && /^async\b/.test(fn.parent.text));
        if (g.kind === 'component') {
          title = `Component: ${g.name}`;
          headline = `${code(g.name)} is a React component: a reusable piece of the page` + (params.length ? `, configured with ${code(params.join(', '))}.` : '.');
          if (F.state.length) facts.push(`It remembers ${plainList(F.state.map(code))} between redraws.`);
          if (F.draws.length) facts.push(`It draws ${plainList(F.draws.filter(d => /^[a-z]/.test(d)).map(d => code('<' + d + '>')), 8) || 'other components'}` + (F.draws.some(d => /^[A-Z]/.test(d)) ? `, using the components ${plainList(F.draws.filter(d => /^[A-Z]/.test(d)).map(code))}.` : '.'));
        } else if (g.kind === 'class') {
          title = `Class: ${g.name}`;
          const methods = [...walk(fn)].filter(x => x.type === 'method_definition').map(x => field(x, 'name').text);
          headline = `${code(g.name)} is a class: a blueprint for making objects.`;
          if (methods.length) facts.push(`It can: ${plainList(methods.filter(m => m !== 'constructor').map(code), 8)}.`);
        } else {
          title = `Tool: ${g.name}`;
          headline = `${code(g.name)} is a reusable tool that ${params.length ? 'takes ' + plainList(params.map(code)) : 'takes no inputs'}.`;
          facts.push(F.returns ? 'It gives back a result.' : 'It doesn\'t give anything back; it does its work through what it changes or shows.');
        }
        if (isAsync) facts.push('It is `async`: it can wait (for the server, for example) without freezing the page.');
        if (note) facts.unshift('The comment above it says: ' + note);
      } else if (g.kind === 'route') {
        title = `Web route ${g.method} ${g.path}`;
        headline = `Handles ${g.method} requests to ${code(g.path)} on the server.`;
      } else if (g.kind === 'handler') {
        const ev = (g.nodes[0].text.match(/^(.*?)\.addEventListener\(\s*['"`](\w+)/) || []);
        title = ev[2] ? `When ${ev[1]} gets "${ev[2]}"` : 'Reacts to events';
        headline = ev[2] ? `Runs when ${code(ev[1])} gets a ${code(ev[2])} event${ev[2] === 'click' ? ' (a click)' : ev[2] === 'submit' ? ' (a form is sent)' : ev[2] === 'DOMContentLoaded' ? ' (the page has finished loading)' : ''}.` : 'Reacts to things happening on the page.';
      } else {
        headline = `${g.nodes.length} step${g.nodes.length === 1 ? ' that runs' : 's that run'} from top to bottom when the script loads.`;
        if (note) facts.push('The comment above says: ' + note);
      }
      // shared facts
      if (F.dom.length) {
        const linked = F.dom.map(sel => { const hit = ctx.htmlTargets(sel); return hit ? `${code(sel)} in [[${hit}]]` : code(sel); });
        facts.push('Works with these parts of the page: ' + plainList(linked, 8) + '.');
      }
      if (F.events.length) facts.push('Listens for: ' + plainList(F.events, 6) + '.');
      for (const ft of F.fetches) {
        const route = ctx.routeFor(ft.method, ft.url);
        facts.push(`Talks to the server: ${ft.method} ${code(ft.url)}` + (route ? `, answered by [[${route.path}#${route.name}]]` : ft.dynamic ? '' : ctx.hasServer ? ' (no matching route found in this project)' : '') + '.');
        ctx.fetches.push({ ...ft, from: path, route });
      }
      if (F.effects.length) facts.push('Along the way it ' + plainList(F.effects, 6) + '.');
      if (F.libs.length) facts.push('Uses ' + plainList(F.libs.map(libPhrase)) + '.');
      if (F.calls.length && g.kind !== 'imports') facts.push('Runs other tools: ' + plainList(F.calls, 6) + '.');
      if (F.loops || F.decisions) facts.push('Contains ' + [F.loops ? `${F.loops} loop${F.loops > 1 ? 's' : ''}` : '', F.decisions ? `${F.decisions} decision${F.decisions > 1 ? 's' : ''}` : ''].filter(Boolean).join(' and ') + '.');
      if (F.handles) facts.push('Handles errors instead of stopping.');
      const warnings = F.warnings.slice();
      if ((g.kind === 'tool' || g.kind === 'component') && end - start > 80) warnings.push(`This is ${end - start + 1} lines long. It may be doing several jobs that could be split up.`);
      for (let i = start - 1; i < end; i++) { const m = lines[i] && lines[i].match(/\/\/\s*(TODO|FIXME|HACK|XXX)\b:?\s*(.*)/); if (m) warnings.push(`Line ${i + 1} has a ${m[1]} note: ${m[2].trim() || '(no details)'}`); }
      const bodyNodes = g.kind === 'tool' || g.kind === 'component' ? (field(g.fn, 'body') && field(g.fn, 'body').type === 'statement_block' ? field(g.fn, 'body').namedChildren : []) : g.kind === 'imports' || g.kind === 'settings' ? [] : g.nodes;
      const st = jsStepLines(bodyNodes, source);
      sections.push({ id: id++, kind: g.kind, title, headline, facts, warnings: warnings.slice(0, 6), steps: st.steps, more: st.more, start, end, name: g.name || null, lang: 'js' });
    }
    const libs = [...new Set(imps.filter(i => !i.source.startsWith('.')).map(i => pkgOf(i.source)))];
    const comps = sections.filter(s => s.kind === 'component').length, tools = sections.filter(s => s.kind === 'tool').length, routes = sections.filter(s => s.kind === 'route').length;
    const parts = [comps && `${comps} React component${comps > 1 ? 's' : ''}`, tools && `${tools} tool${tools > 1 ? 's' : ''} (functions)`, routes && `${routes} web route${routes > 1 ? 's' : ''}`].filter(Boolean);
    const overview = `${path} ` + `contains ${parts.length ? plainList(parts) : 'top-level steps only'}.` + (libs.length ? ' It uses ' + plainList(libs.map(libPhrase), 8) + '.' : '');
    return { ok: !rootNode.hasError(), error: rootNode.hasError() ? 'Some of this file could not be read; it may use syntax the reader does not know yet.' : '', overview, sections, lines: lines.length, imports: imps, libs };
  }

  /* ------------------------------------------------------------------ */
  /* HTML                                                                */
  /* ------------------------------------------------------------------ */

  function htmlElements(rootNode) {
    // flat list of elements: {tag, attrs, node, text, parent index}
    const out = [];
    const visit = (n, parent) => {
      if (n.type === 'element' || n.type === 'script_element' || n.type === 'style_element') {
        const start = n.namedChildren.find(c => c.type === 'start_tag' || c.type === 'self_closing_tag');
        const tag = start ? (start.namedChildren.find(c => c.type === 'tag_name') || { text: '?' }).text.toLowerCase() : '?';
        const attrs = {};
        if (start) for (const a of start.namedChildren.filter(c => c.type === 'attribute')) {
          const nm = a.namedChildren.find(c => c.type === 'attribute_name');
          const v = a.namedChildren.find(c => c.type === 'quoted_attribute_value' || c.type === 'attribute_value');
          if (nm) attrs[nm.text.toLowerCase()] = v ? unquote(v.text) : '';
        }
        const text = n.namedChildren.filter(c => c.type === 'text').map(c => c.text.trim()).join(' ').trim();
        const el = { tag, attrs, node: n, text, parent, index: out.length, children: [] };
        out.push(el);
        if (parent != null) out[parent].children.push(el.index);
        for (const c of n.namedChildren) visit(c, el.index);
      } else for (const c of n.namedChildren) visit(c, parent);
    };
    visit(rootNode, null);
    return out;
  }
  const allText = (el, els) => [el.text, ...el.children.map(i => allText(els[i], els))].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  const describeEl = (el) => el.attrs.id ? `#${el.attrs.id}` : el.attrs.class ? `${el.tag}.${el.attrs.class.split(/\s+/)[0]}` : el.tag;
  const LANDMARK = { header: 'Header', nav: 'Navigation', main: 'Main content', section: 'Section', article: 'Article', aside: 'Side panel', footer: 'Footer', form: 'Form', dialog: 'Pop-up dialog' };

  function htmlSentence(el, els, depth, out, limit) {
    if (out.length > limit) return;
    const pad = '    '.repeat(depth);
    const t = allText(el, els).slice(0, 60);
    const called = el.attrs.id ? ` called ${el.attrs.id}` : '';
    const q = (s) => `"${s.replace(/"/g, "'")}"`;
    const map = {
      h1: () => `add a big heading ${q(t)}`, h2: () => `add a heading ${q(t)}`, h3: () => `add a small heading ${q(t)}`,
      p: () => `add a paragraph ${q(t)}`, button: () => `add a button${called} saying ${q(t)}`,
      a: () => `add a link to ${q(el.attrs.href || '')} saying ${q(t)}`, img: () => `add a picture${called} of ${q(el.attrs.src || '')}` + (el.attrs.alt ? ` described as ${q(el.attrs.alt)}` : ' (no description!)'),
      input: () => `add a ${el.attrs.type && el.attrs.type !== 'text' ? el.attrs.type + ' ' : 'text '}box${called}` + (el.attrs.placeholder ? ` with hint ${q(el.attrs.placeholder)}` : ''),
      textarea: () => `add a big text box${called}`, select: () => `add a drop-down list${called}`, label: () => `add a label ${q(t)}`,
      ul: () => `add a list${called}`, ol: () => `add a numbered list${called}`, li: () => `add a list item ${q(t)}`,
      script: () => el.attrs.src ? `use the script ${q(el.attrs.src)}` : 'run a script written into the page', link: () => el.attrs.rel === 'stylesheet' ? `use the styles in ${q(el.attrs.href || '')}` : null,
      title: () => `set the page title to ${q(t)}`, meta: () => null, br: () => null, span: () => (t ? `add text ${q(t)}` : null),
      table: () => `add a table${called}`, video: () => `add a video of ${q(el.attrs.src || '')}`, canvas: () => `add a drawing area${called}`, iframe: () => `show another page from ${q(el.attrs.src || '')}`,
    };
    const f = map[el.tag];
    let s = f ? f() : `add a ${el.tag}${called}` + (el.attrs.class ? ` in group ${el.attrs.class.split(/\s+/)[0]}` : '');
    if (s === null) return;
    if (el.attrs.class && f && !/in group/.test(s)) s += ` in group ${el.attrs.class.split(/\s+/)[0]}`;
    out.push(pad + s);
    const leaf = ['h1', 'h2', 'h3', 'p', 'button', 'a', 'label', 'li', 'title', 'span', 'option'].includes(el.tag);
    if (!leaf) for (const i of el.children) htmlSentence(els[i], els, depth + 1, out, limit);
  }

  function analyzeHtml(path, source, ctx) {
    const rootNode = parse('html', source);
    const els = htmlElements(rootNode);
    const lines = source.split('\n');
    const byTag = (t) => els.filter(e => e.tag === t);
    const title = (byTag('title')[0] || {}).text || '';
    const scripts = byTag('script').filter(e => e.attrs.src).map(e => e.attrs.src);
    const styles = byTag('link').filter(e => /stylesheet/i.test(e.attrs.rel || '')).map(e => e.attrs.href);
    const inlineScripts = byTag('script').filter(e => !e.attrs.src && e.node.text.length > 30);
    const sections = [];
    let id = 0;
    const pageWarnings = [];
    const head = byTag('head')[0];
    if (head) {
      const facts = [];
      if (title) facts.push(`The browser tab shows ${code(title)}.`);
      const desc = byTag('meta').find(m => m.attrs.name === 'description');
      if (desc) facts.push(`Search engines see the description: "${desc.attrs.content}"`);
      if (styles.length) facts.push('Uses the styles in ' + plainList(styles.map(s => ctx.fileOf(s, path) ? `[[${ctx.fileOf(s, path)}]]` : code(s))) + '.');
      if (scripts.length) facts.push('Loads the scripts ' + plainList(scripts.map(s => ctx.fileOf(s, path) ? `[[${ctx.fileOf(s, path)}]]` : code(s))) + '.');
      if (!byTag('meta').some(m => m.attrs.name === 'viewport')) pageWarnings.push('There is no viewport setting, so phones will show the page zoomed out. Add <meta name="viewport" content="width=device-width, initial-scale=1">.');
      const out = ['']; for (const i of head.children) htmlSentence(els[i], els, 0, out, 12);
      sections.push({ id: id++, kind: 'head', title: 'Page information', headline: title ? `The page is called ${code(title)}.` : 'Information about the page for the browser (it has no title).', facts, warnings: [], steps: out.slice(1), more: false, start: line(head.node), end: endLine(head.node), lang: 'html' });
    }
    const body = byTag('body')[0];
    const top = body ? body.children.map(i => els[i]) : els.filter(e => e.parent == null && e.tag !== 'html' && e.tag !== 'head');
    // group top-level body children: landmarks become their own sections, others are gathered
    let loose = [];
    const flush = () => {
      if (!loose.length) return;
      const out = []; loose.forEach(e => htmlSentence(e, els, 0, out, 14));
      sections.push({ id: id++, kind: 'part', title: 'Page content', headline: `${loose.length} item${loose.length > 1 ? 's' : ''} directly on the page.`, facts: [], warnings: [], steps: out.slice(0, 14), more: out.length > 14, start: line(loose[0].node), end: endLine(loose[loose.length - 1].node), lang: 'html' });
      loose = [];
    };
    for (const el of top) {
      const isBlock = LANDMARK[el.tag] || (el.tag === 'div' && (el.attrs.id || el.children.length > 2));
      if (!isBlock || el.tag === 'script') { if (el.tag !== 'script') loose.push(el); continue; }
      flush();
      const inside = [el, ...[...walk(el.node)].length ? [] : []];
      const sub = els.filter(e => { let p = e.parent; while (p != null) { if (p === el.index) return true; p = els[p].parent; } return false; });
      const facts = [];
      const heading = sub.find(e => /^h[1-6]$/.test(e.tag));
      const count = (t) => sub.filter(e => e.tag === t).length;
      const bits = [['button', 'button'], ['a', 'link'], ['input', 'input box'], ['img', 'picture'], ['form', 'form'], ['li', 'list item']].map(([t, w]) => count(t) ? `${count(t)} ${w}${count(t) > 1 ? 's' : ''}` : '').filter(Boolean);
      if (heading) facts.push(`Its heading is ${code(allText(heading, els).slice(0, 80))}.`);
      if (bits.length) facts.push('It contains ' + plainList(bits) + '.');
      if (el.tag === 'form') facts.push(`When sent, it goes to ${code(el.attrs.action || 'this same page')} using ${(el.attrs.method || 'GET').toUpperCase()}.`);
      const ids = sub.concat([el]).filter(e => e.attrs.id).map(e => '#' + e.attrs.id);
      const scripted = ids.map(i => ctx.scriptsFor(i)).flat();
      if (scripted.length) facts.push('Scripts that work with it: ' + plainList([...new Set(scripted)].map(p => `[[${p}]]`)) + '.');
      const styled = ctx.stylesFor(el, sub);
      if (styled.length) facts.push('Styled by ' + plainList(styled.map(s => `${code(s.selector)} in [[${s.path}]]`), 5) + '.');
      const warnings = [];
      for (const e of sub.concat([el])) {
        if (e.tag === 'img' && !('alt' in e.attrs)) add(warnings, `A picture (${code(e.attrs.src || 'img')}) has no description (alt text), so screen readers can't describe it.`);
        if (Object.keys(e.attrs).some(a => /^on[a-z]+$/.test(a))) add(warnings, `${code(describeEl(e))} has its behaviour written into the HTML (${Object.keys(e.attrs).filter(a => /^on/.test(a)).join(', ')}). It's easier to maintain in a script file.`);
        if (e.tag === 'input' && e.attrs.type === 'password' && el.tag === 'form' && (el.attrs.method || 'get').toLowerCase() === 'get') add(warnings, 'A form with a password is sent with GET, which puts the password in the web address. Use method="post".');
        if (e.tag === 'a' && e.attrs.target === '_blank' && !/noopener|noreferrer/.test(e.attrs.rel || '')) add(warnings, `A link opens a new tab without rel="noopener", which lets the new page control this one in older browsers.`);
        if (/^http:\/\//.test(e.attrs.src || e.attrs.href || '')) add(warnings, `${code(e.attrs.src || e.attrs.href)} is not encrypted (http, not https).`);
      }
      const out = []; htmlSentence(el, els, 0, out, 14);
      const name = LANDMARK[el.tag] || 'Block';
      sections.push({ id: id++, kind: 'part', title: `${name}${el.attrs.id ? ' #' + el.attrs.id : el.attrs.class ? ' .' + el.attrs.class.split(/\s+/)[0] : ''}`, headline: `${name === 'Block' ? 'A block' : 'The ' + name.toLowerCase()} of the page${heading ? ', headed ' + code(allText(heading, els).slice(0, 50)) : ''}.`, facts, warnings, steps: out, more: out.length >= 14, start: line(el.node), end: endLine(el.node), lang: 'html', name: el.attrs.id || null });
    }
    flush();
    if (inlineScripts.length) sections.push({ id: id++, kind: 'script', title: 'Script inside the page', headline: `${inlineScripts.length} script${inlineScripts.length > 1 ? 's are' : ' is'} written directly into this page.`, facts: ['Scripts in their own .js file are easier to read, test and reuse.'], warnings: [], steps: [], more: false, start: line(inlineScripts[0].node), end: endLine(inlineScripts[inlineScripts.length - 1].node), lang: 'html' });
    if (!source.match(/<html[^>]*\blang=/i) && /<html/i.test(source)) pageWarnings.push('The page doesn\'t say what language it is in (<html lang="en">), which helps screen readers and translation.');
    if (sections[0]) sections[0].warnings.push(...pageWarnings);
    const counts = ['button', 'a', 'input', 'img', 'form'].map(t => [t, byTag(t).length]).filter(x => x[1]);
    const overview = `${path} is a web page${title ? ` called ${code(title)}` : ''}.` + (counts.length ? ' It has ' + plainList(counts.map(([t, n]) => `${n} ${{ button: 'button', a: 'link', input: 'input box', img: 'picture', form: 'form' }[t]}${n > 1 ? 's' : ''}`)) + '.' : '');
    return { ok: true, overview, sections, lines: lines.length, els, scripts, styles, ids: els.filter(e => e.attrs.id).map(e => e.attrs.id), classes: [...new Set(els.flatMap(e => (e.attrs.class || '').split(/\s+/).filter(Boolean)))], tags: [...new Set(els.map(e => e.tag))] };
  }

  /* ------------------------------------------------------------------ */
  /* CSS                                                                 */
  /* ------------------------------------------------------------------ */

  function colorName(v) {
    v = v.trim().toLowerCase();
    let r, g, b, a = 1;
    let m = v.match(/^#([0-9a-f]{3,8})$/);
    if (m) {
      let h = m[1];
      if (h.length <= 4) h = h.split('').map(c => c + c).join('');
      r = parseInt(h.slice(0, 2), 16); g = parseInt(h.slice(2, 4), 16); b = parseInt(h.slice(4, 6), 16);
      if (h.length === 8) a = parseInt(h.slice(6, 8), 16) / 255;
    } else if ((m = v.match(/^rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)(?:[ ,/]+([\d.]+%?))?/))) {
      r = +m[1]; g = +m[2]; b = +m[3]; if (m[4]) a = m[4].endsWith('%') ? parseFloat(m[4]) / 100 : +m[4];
    } else if (/^(white|black|red|green|blue|yellow|orange|purple|pink|grey|gray|transparent|brown|navy|teal)$/.test(v)) return v === 'gray' ? 'grey' : v;
    else if (/^var\(/.test(v)) return `the colour ${code(v.replace(/^var\(|\)$/g, ''))}`;
    else return code(v);
    const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 510, s = max === min ? 0 : (max - min) / (255 - Math.abs(max + min - 255));
    let name;
    if (l < 0.1) name = 'near-black';
    else if (l > 0.94) name = 'white';
    else if (s < 0.12) name = l > 0.95 ? 'white' : l > 0.75 ? 'light grey' : l > 0.4 ? 'grey' : l > 0.12 ? 'dark grey' : 'near-black';
    else {
      let h = 0;
      const d = max - min;
      if (max === r) h = ((g - b) / d) % 6; else if (max === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
      h = (h * 60 + 360) % 360;
      const hue = h < 15 ? 'red' : h < 40 ? 'orange' : h < 65 ? 'yellow' : h < 160 ? 'green' : h < 195 ? 'teal' : h < 255 ? 'blue' : h < 290 ? 'purple' : h < 335 ? 'pink' : 'red';
      name = (l > 0.75 ? 'light ' : l < 0.3 ? 'dark ' : '') + hue;
    }
    return name + (a < 1 ? `, ${Math.round((1 - a) * 100)}% see-through` : '');
  }

  function describeDecl(prop, value) {
    const v = value.trim();
    const col = () => colorName(v.replace(/\s*!important$/, ''));
    const P = {
      color: () => `${col()} text`, background: () => /url\(/.test(v) ? 'a background picture' : /gradient/.test(v) ? 'a colour gradient background' : `${col()} background`,
      'background-color': () => `${col()} background`, padding: () => /^0(px)?$/.test(v) ? 'no space inside' : `space inside of ${v}`, margin: () => /auto/.test(v) ? 'centred' : /^0(px)?$/.test(v) ? 'no space around' : `space around of ${v}`,
      'border-radius': () => /50%|999/.test(v) ? 'round corners (a circle or pill)' : `rounded corners (${v})`, border: () => v === 'none' || v === '0' ? 'no border' : `a border (${v})`,
      'box-shadow': () => v === 'none' ? 'no shadow' : 'a shadow', 'font-size': () => `text size ${v}`, 'font-weight': () => /bold|[6-9]00/.test(v) ? 'bold text' : `text weight ${v}`,
      'font-family': () => `the font ${v.split(',')[0].replace(/['"]/g, '')}`, display: () => ({ none: 'hidden', flex: 'arranges its contents in a row or column (flex)', grid: 'arranges its contents in a grid', block: 'takes a full line', 'inline-block': 'sits in a line of text but keeps its size' }[v] || `display ${v}`),
      'flex-direction': () => v === 'column' ? 'contents stacked top to bottom' : 'contents side by side', 'justify-content': () => `contents spread: ${v}`, 'align-items': () => `contents lined up: ${v}`, gap: () => `a gap of ${v} between items`,
      'grid-template-columns': () => { const n = v.match(/repeat\((\d+)/); return n ? `${n[1]} columns` : `${v.split(/\s+/).length} columns`; },
      width: () => `width ${v}`, height: () => `height ${v}`, 'max-width': () => `at most ${v} wide`, 'min-height': () => `at least ${v} tall`,
      opacity: () => `${Math.round((1 - parseFloat(v)) * 100)}% see-through (including everything inside)`, position: () => ({ absolute: 'placed at an exact spot', fixed: 'stays in place when scrolling', sticky: 'sticks when scrolled to', relative: 'can be nudged from its normal place' }[v] || `position ${v}`),
      'z-index': () => `layer ${v}`, transition: () => 'changes smoothly', animation: () => 'animated', cursor: () => v === 'pointer' ? 'a hand cursor (looks clickable)' : `cursor ${v}`,
      'text-align': () => `${v}-aligned text`, 'line-height': () => `line spacing ${v}`, overflow: () => v === 'hidden' ? 'hides anything that spills out' : v === 'auto' || v === 'scroll' ? 'scrolls if too big' : `overflow ${v}`,
      transform: () => 'moved, turned or resized', filter: () => 'a visual effect (filter)', 'text-decoration': () => v === 'none' ? 'no underline' : `text ${v}`, visibility: () => v === 'hidden' ? 'invisible but still takes space' : `visibility ${v}`,
    };
    return P[prop] ? P[prop]() : prop.startsWith('--') ? `sets the value ${code(prop)} to ${code(v)}` : `${prop}: ${v}`;
  }

  function cssRules(rootNode, source) {
    const rules = [];   // {selectors[], decls[[prop,value]], media, node}
    const visit = (n, media) => {
      if (n.type === 'rule_set') {
        const sels = n.namedChildren.find(c => c.type === 'selectors');
        const block = n.namedChildren.find(c => c.type === 'block');
        const decls = block ? block.namedChildren.filter(c => c.type === 'declaration').map(d => {
          const p = d.namedChildren.find(c => c.type === 'property_name');
          const valText = d.text.slice(d.text.indexOf(':') + 1).replace(/;$/, '').trim();
          return [p ? p.text : '?', valText];
        }) : [];
        rules.push({ selectors: sels ? sels.text.split(',').map(s => s.trim()) : [], decls, media, node: n });
        return;
      }
      if (n.type === 'media_statement') {
        const q = n.text.slice(0, n.text.indexOf('{')).replace(/^@media/, '').trim();
        for (const c of n.namedChildren) if (c.type === 'block') for (const cc of c.namedChildren) visit(cc, q);
        return;
      }
      for (const c of n.namedChildren) visit(c, media);
    };
    visit(rootNode, null);
    return rules;
  }

  function mediaWords(q) {
    const w = q.match(/max-width:\s*([\d.]+\w+)/), m = q.match(/min-width:\s*([\d.]+\w+)/);
    if (w && !m) return `on screens narrower than ${w[1]}`;
    if (m && !w) return `on screens at least ${m[1]} wide`;
    if (/prefers-color-scheme:\s*dark/.test(q)) return 'when the device is in dark mode';
    if (/prefers-reduced-motion/.test(q)) return 'when the person has asked for less motion';
    if (/print/.test(q)) return 'when printing';
    return `when ${code(q)}`;
  }

  function selectorWords(sel) {
    if (sel === ':root') return 'the whole page (shared values)';
    if (sel === '*') return 'everything';
    if (/^body$|^html$/.test(sel)) return 'the whole page';
    if (/^#[\w-]+$/.test(sel)) return `the element ${code(sel)}`;
    if (/^\.[\w-]+$/.test(sel)) return `everything in group ${code(sel.slice(1))}`;
    if (/^[a-z][a-z0-9]*$/.test(sel)) return `every ${code('<' + sel + '>')}`;
    const hover = sel.match(/^(.*):hover$/);
    if (hover) return `${selectorWords(hover[1])} while the mouse is over it`;
    return code(sel);
  }

  function analyzeCss(path, source, ctx) {
    const rootNode = parse('css', source);
    const rules = cssRules(rootNode, source);
    const lines = source.split('\n');
    const sections = [];
    let id = 0;
    let important = 0, colors = new Set();
    // group consecutive rules by media query; each rule with a simple selector is its own section
    for (const r of rules) {
      for (const [p, v] of r.decls) { if (/!important/.test(v)) important++; for (const c of v.match(/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)/gi) || []) colors.add(c.toLowerCase()); }
      const words = r.decls.map(([p, v]) => describeDecl(p, v));
      const facts = [];
      const where = r.selectors.map(s => { const hits = ctx.htmlMatches(s); return hits.length ? `${code(s)} (used in ${plainList(hits.map(h => `[[${h}]]`), 3)})` : code(s); });
      facts.push('Applies to ' + plainList(where, 6) + '.');
      const warnings = [];
      if (ctx.hasHtml) for (const s of r.selectors) if (/^[.#][\w-]+$/.test(s) && !ctx.htmlMatches(s).length && !ctx.scriptMentions(s)) add(warnings, `Nothing in the project's HTML or scripts uses ${code(s)}, so this style may be left over.`);
      if (r.decls.some(([p, v]) => /!important/.test(v))) add(warnings, '`!important` forces this style over others. Too many make styles hard to change later.');
      if (r.decls.some(([p, v]) => p === 'opacity' && parseFloat(v) < 1)) facts.push('Note: `opacity` fades everything inside it too. To fade only the background, use a see-through background colour instead.');
      if (r.decls.some(([p, v]) => p === 'position' && v === 'absolute')) facts.push('Placed at an exact spot: this can overlap or break on different screen sizes. Flex or grid layouts adapt better.');
      const cap = (x) => x[0].toUpperCase() + x.slice(1);
      sections.push({ id: id++, kind: r.media ? 'media' : 'style', title: (r.media ? `${mediaWords(r.media)}: ` : '') + r.selectors.join(', '), headline: cap(`${r.media ? mediaWords(r.media) + ', ' : ''}${plainList(r.selectors.map(selectorWords), 3)} ${r.selectors.length > 1 ? 'get' : 'gets'}: ${plainList(words, 8) || 'nothing yet'}.`), facts, warnings, steps: [`style ${r.selectors.join(', ')}: ` + r.decls.map(([p, v]) => `${p} ${v}`).join(', ')], more: false, start: line(r.node), end: endLine(r.node), lang: 'css', name: r.selectors[0] });
    }
    const sectionsWarn = [];
    if (important > 3) sectionsWarn.push(`Uses \`!important\` ${important} times. It usually means styles are fighting each other.`);
    if (colors.size > 8 && !/--[\w-]+\s*:/.test(source)) sectionsWarn.push(`Uses ${colors.size} different colours written out by hand. Keeping them as named variables (--main-colour) makes a theme easier to change.`);
    if (sections[0]) sections[0].warnings.push(...sectionsWarn);
    const media = new Set(rules.filter(r => r.media).map(r => mediaWords(r.media)));
    const overview = `${path} holds ${rules.length} style rule${rules.length === 1 ? '' : 's'}` + (media.size ? `, with changes ${plainList([...media], 4)}` : '') + '.';
    return { ok: !rootNode.hasError(), error: rootNode.hasError() ? 'Some of this file could not be read.' : '', overview, sections, lines: lines.length, rules };
  }


  /* ------------------------------------------------------------------ */
  /* C++ (including Arduino sketches)                                    */
  /* ------------------------------------------------------------------ */

  const CPP_LIBS = {
    iostream: 'reads and writes text in the terminal', string: 'works with text', vector: 'lists that can grow', map: 'dictionaries (keys and values)',
    unordered_map: 'fast dictionaries', set: 'collections without duplicates', cmath: 'does maths', fstream: 'reads and writes files',
    algorithm: 'sorts and searches', memory: 'smart pointers that free memory automatically', thread: 'does several things at once',
    chrono: 'measures time', random: 'makes random numbers', cstdio: 'C-style input and output', cstring: 'C-style text', cstdlib: 'C-style helpers',
    sstream: 'builds text piece by piece', iomanip: 'formats numbers in output', array: 'fixed-size lists', 'Arduino.h': 'the Arduino board',
    'Servo.h': 'controls servo motors', 'Wire.h': 'talks to I2C devices', 'SPI.h': 'talks to SPI devices', 'SoftwareSerial.h': 'extra serial ports',
  };

  function cppFacts(nodes, src) {
    const f = { effects: [], warnings: [], loops: 0, decisions: 0, news: 0, deletes: 0, pins: false, refs: [], ptrs: false, throws: false, catches: false, calls: [] };
    for (const top of nodes) for (const n of walk(top)) {
      const t = n.type, text = n.text;
      if (/^(for|for_range_loop|while|do)_statement$/.test(t) || t === 'for_range_loop') f.loops++;
      else if (t === 'if_statement' || t === 'switch_statement' || t === 'conditional_expression') f.decisions++;
      else if (t === 'new_expression') f.news++;
      else if (t === 'delete_expression') f.deletes++;
      else if (t === 'throw_statement') f.throws = true;
      else if (t === 'catch_clause') { f.catches = true; const b = n.namedChildren.find(c => c.type === 'compound_statement'); if (b && b.namedChildCount === 0) add(f.warnings, 'Catches an error and does nothing with it, so problems can fail silently.'); }
      else if (t === 'reference_declarator' && n.parent && n.parent.type === 'parameter_declaration') add(/^const\b/.test(n.parent.text) ? (f.crefs = f.crefs || []) : f.refs, n.text.replace(/^&\s*/, ''));
      else if (t === 'pointer_declarator') f.ptrs = true;
      else if (t === 'binary_expression' && /^(std::)?cout\b|^Serial\.print/.test(text)) add(f.effects, 'shows text');
      else if (t === 'binary_expression' && /^(std::)?cin\b/.test(text)) add(f.effects, 'reads what the person types');
      else if (t === 'call_expression') {
        const fn = (n.namedChild(0) || {}).text || '';
        if (/^(printf|puts|Serial\.(print|println|write))$/.test(fn)) add(f.effects, 'shows text');
        else if (/^(scanf|getline|std::getline|Serial\.read\w*)$/.test(fn)) add(f.effects, 'reads input');
        else if (/^(fopen|std::ifstream|std::ofstream)$/.test(fn)) add(f.effects, 'works with files');
        else if (/^(malloc|calloc|realloc)$/.test(fn)) { f.news++; add(f.effects, 'reserves memory by hand'); }
        else if (fn === 'free') f.deletes++;
        else if (/^(std::)?make_(unique|shared)$/.test(fn)) add(f.effects, 'makes a smart pointer (memory is freed automatically)');
        else if (/^(pinMode|digitalWrite|digitalRead|analogRead|analogWrite)$/.test(fn)) { f.pins = true; add(f.effects, 'controls pins on the board'); }
        else if (fn === 'delay' || fn === 'delayMicroseconds') add(f.effects, 'waits');
        else if (/^(strcpy|strcat|sprintf|gets)$/.test(fn)) add(f.warnings, `Uses ${code(fn)}, which can write past the end of its memory (a buffer overflow). Safer: ${fn === 'gets' ? 'std::getline' : fn === 'sprintf' ? 'snprintf or std::string' : 'std::string'}.`);
        else if (/^(system)$/.test(fn)) add(f.warnings, 'Uses `system()` to run a shell command. If any part comes from users, they could run their own commands.');
        else if (/^[a-zA-Z_]\w*$/.test(fn)) add(f.calls, fn);
      }
    }
    if (/\bofstream\b|\bifstream\b|\bfopen\b/.test(nodes.map(n => n.text).join('\n'))) add(f.effects, 'works with files');
    return f;
  }

  function cppType(n) {
    const t = n.childForFieldName('type');
    return t ? t.text : '';
  }
  function cppParams(fn) {
    const decl = fn.childForFieldName('declarator');
    const pl = decl && (decl.childForFieldName('parameters') || [...walk(decl)].find(x => x.type === 'parameter_list'));
    return pl ? pl.namedChildren.filter(c => /parameter_declaration/.test(c.type)).map(c => c.text) : [];
  }
  function cppName(fn) {
    const decl = fn.childForFieldName('declarator');
    const id = decl && [...walk(decl)].find(x => /identifier$/.test(x.type) && x.type !== 'type_identifier');
    return id ? id.text : 'function';
  }

  function cppStepLines(nodes, limit = 16) {
    const out = [];
    const pad = (d) => '    '.repeat(d);
    const flat = (n) => n.text.replace(/\s+/g, ' ');
    const short = (s) => s.length > 70 ? s.slice(0, 67) + '…' : s;
    const words = (n) => {
      if (!n) return '';
      if (n.type === 'binary_expression') {
        const op = n.child(1) ? n.child(1).type : '';
        const w = { '==': 'is', '!=': 'is not', '>': 'is more than', '<': 'is less than', '>=': 'is at least', '<=': 'is at most', '&&': 'and', '||': 'or', '+': 'plus', '-': 'minus', '*': 'times', '/': 'divided by', '%': 'mod' }[op];
        if (w) return `${words(n.childForFieldName('left'))} ${w} ${words(n.childForFieldName('right'))}`;
      }
      if (n.type === 'parenthesized_expression' || n.type === 'condition_clause') return words(n.namedChild(0));
      if (n.type === 'true') return 'yes';
      if (n.type === 'false') return 'no';
      if (n.type === 'null' || n.text === 'nullptr') return 'nothing';
      return short(flat(n));
    };
    const block = (b, d) => { if (!b) return; if (b.type === 'compound_statement') b.namedChildren.forEach(c => visit(c, d)); else visit(b, d); };
    const visit = (n, d) => {
      if (out.length > limit) return;
      const t = n.type;
      if (t === 'comment') { out.push(pad(d) + 'note: ' + n.text.replace(/^\/\/\s?|^\/\*+|\*+\/$/g, '').trim().slice(0, 80)); return; }
      if (t === 'declaration') {
        const type = cppType(n);
        for (const d2 of n.namedChildren.filter(c => /declarator$/.test(c.type) && c.type !== 'type_qualifier')) {
          if (d2.type === 'init_declarator') {
            const name = flat(d2.childForFieldName('declarator') || d2.namedChild(0));
            const v = d2.childForFieldName('value') || d2.namedChild(1);
            const call = v && v.type === 'call_expression' && /^(analogRead|digitalRead)$/.test(flat(v.namedChild(0)));
            out.push(pad(d) + (call ? `read pin ${words(v.namedChild(1).namedChild(0))} and store in ${name}` : `create ${type} ${name}` + (v ? ` set to ${words(v)}` : '')));
          } else out.push(pad(d) + `create ${type} ${flat(d2)}`);
        }
        return;
      }
      if (t === 'expression_statement') {
        const e = n.namedChild(0);
        if (!e) return;
        if (e.type === 'binary_expression' && /^(std::)?cout\b/.test(e.text)) { out.push(pad(d) + 'show ' + e.text.replace(/^(std::)?cout\s*<<\s*/, '').split(/\s*<<\s*/).filter(x => !/^(std::)?endl$|^"\\n"$/.test(x)).join(' and ')); return; }
        if (e.type === 'binary_expression' && /^(std::)?cin\b/.test(e.text)) { out.push(pad(d) + 'ask and store in ' + e.text.replace(/^(std::)?cin\s*>>\s*/, '').split(/\s*>>\s*/).join(', ')); return; }
        if (e.type === 'assignment_expression') { const op = e.child(1).type; const l = flat(e.childForFieldName('left')), r = words(e.childForFieldName('right')); out.push(pad(d) + (op === '+=' ? `increase ${l} by ${r}` : op === '-=' ? `decrease ${l} by ${r}` : `set ${l} to ${r}`)); return; }
        if (e.type === 'update_expression') { out.push(pad(d) + `${/\+\+/.test(e.text) ? 'increase' : 'decrease'} ${e.text.replace(/\+\+|--/g, '')} by 1`); return; }
        if (e.type === 'call_expression') {
          const fn = flat(e.namedChild(0)); const args = e.namedChild(1); const a = args ? args.namedChildren.map(words) : [];
          const arduino = {
            delay: () => `wait ${a[0]} milliseconds`, delayMicroseconds: () => `wait ${a[0]} microseconds`,
            digitalWrite: () => `turn ${a[0]} ${/HIGH/.test(a[1]) ? 'on' : /LOW/.test(a[1]) ? 'off' : 'to ' + a[1]}`,
            pinMode: () => `use pin ${a[0]} as ${/INPUT_PULLUP/.test(a[1]) ? 'an input (with pull-up)' : /INPUT/.test(a[1]) ? 'an input' : 'an output'}`,
            'Serial.println': () => `show ${a.join(' and ')} on the serial monitor`, 'Serial.print': () => `show ${a.join(' and ')} on the serial monitor (same line)`,
            'Serial.begin': () => `start the serial monitor at ${a[0]} speed`, analogWrite: () => `set pin ${a[0]} to strength ${a[1]}`,
          }[fn];
          out.push(pad(d) + (arduino ? arduino() : `run ${fn}` + (a.length ? ' with ' + a.join(', ') : '')));
          return;
        }
      }
      if (t === 'if_statement') {
        out.push(pad(d) + `if ${words(n.childForFieldName('condition'))}`);
        block(n.childForFieldName('consequence'), d + 1);
        const alt = n.childForFieldName('alternative');
        if (alt) { out.push(pad(d) + 'otherwise'); block(alt.namedChild(0) || alt, d + 1); }
        return;
      }
      if (t === 'for_statement') {
        const init = n.childForFieldName('initializer'), cond = n.childForFieldName('condition');
        const m = init && cond && init.text.match(/^\w+\s+(\w+)\s*=\s*0;?$/) && cond.text.match(/^(\w+)\s*<\s*(.+)$/);
        out.push(pad(d) + (m && m[1] === init.text.match(/^\w+\s+(\w+)/)[1] ? `repeat ${m[2]} times counting with ${m[1]}` : `repeat: ${short(flat(n).replace(/\{.*$/, ''))}`));
        block(n.childForFieldName('body'), d + 1);
        return;
      }
      if (t === 'for_range_loop') { out.push(pad(d) + `for each ${flat(n.childForFieldName('declarator')).replace(/^[&*]\s*/, '')} in ${words(n.childForFieldName('right'))}`); block(n.childForFieldName('body'), d + 1); return; }
      if (t === 'while_statement') { out.push(pad(d) + `while ${words(n.childForFieldName('condition'))}`); block(n.childForFieldName('body'), d + 1); return; }
      if (t === 'return_statement') { out.push(pad(d) + 'give back' + (n.namedChildCount ? ' ' + words(n.namedChild(0)) : '')); return; }
      if (t === 'try_statement') { out.push(pad(d) + 'try'); block(n.childForFieldName('body'), d + 1); for (const c of n.namedChildren.filter(x => x.type === 'catch_clause')) { out.push(pad(d) + 'if it fails'); block(c.namedChildren.find(x => x.type === 'compound_statement'), d + 1); } return; }
      out.push(pad(d) + 'c++: ' + short(flat(n)));
    };
    for (const n of nodes) visit(n, 0);
    return { steps: out.slice(0, limit), more: out.length > limit };
  }

  function analyzeCpp(path, source, ctx) {
    const rootNode = parse('cpp', source);
    const lines = source.split('\n');
    const isHeader = /\.(h|hh|hpp)$/i.test(path);
    const groups = [];
    const push = (kind, node, extra) => {
      const last = groups[groups.length - 1];
      if (last && last.kind === kind && ['imports', 'settings', 'steps'].includes(kind)) last.nodes.push(node);
      else groups.push({ kind, nodes: [node], ...(extra || {}) });
    };
    const includes = [];
    for (const n of rootNode.namedChildren) {
      const t = n.type;
      if (t === 'comment') continue;
      if (t === 'preproc_call' || (t === 'preproc_ifdef' && /_H\b|_HPP\b/.test(n.text.split('\n')[0]))) { push('imports', n); continue; }
      if (t === 'preproc_include') { const p = n.namedChild(0); includes.push({ name: p ? p.text.replace(/^[<"]|[>"]$/g, '') : '', local: p && p.type === 'string_literal' }); push('imports', n); continue; }
      if (t === 'using_declaration' || t === 'namespace_alias_definition') { push('imports', n); continue; }
      if (t === 'preproc_def' || (t === 'declaration' && /^(static\s+)?(const|constexpr)\b|#define/.test(n.text))) { push('settings', n); continue; }
      if (t === 'function_definition') { const name = cppName(n); push(name === 'main' ? 'start' : name === 'setup' || name === 'loop' ? 'arduino' : 'tool', n, { name, fn: n }); continue; }
      if ((t === 'struct_specifier' || t === 'class_specifier' || (t === 'declaration' && /^(struct|class)\b/.test(n.text))) && /\{/.test(n.text)) {
        const nm = n.childForFieldName('name') || n.namedChildren.find(c => c.type === 'type_identifier');
        push('class', n, { name: nm ? nm.text : 'type', fn: n, struct: /^struct/.test(n.text) });
        continue;
      }
      if (t === 'namespace_definition') { push('steps', n); continue; }
      if (t === 'declaration' && /\(/.test(n.text) && !/=/.test(n.text)) { push('declares', n); continue; }
      push(t === 'declaration' ? 'settings' : 'steps', n);
    }
    const allFacts = cppFacts([rootNode], source);
    const sections = [];
    let id = 0;
    const TITLE = { imports: 'Toolkits used', settings: 'Settings', steps: 'Other code', declares: 'Declarations', tool: 'Tool', start: 'Starting point', arduino: 'Arduino', class: 'Class' };
    for (const g of groups) {
      const first = g.nodes[0];
      let start = line(first);
      while (start > 1 && /^\s*(\/\/|\*|\/\*)/.test(lines[start - 2])) start--;
      const end = endLine(g.nodes[g.nodes.length - 1]);
      const note = commentAbove(lines, line(first) - 1);
      const F = cppFacts(g.nodes, source);
      const facts = [];
      let title = TITLE[g.kind], headline = '';
      let body = [];
      if (g.kind === 'imports') {
        const inc = g.nodes.filter(n => n.type === 'preproc_include').map(n => n.namedChild(0) ? n.namedChild(0).text : '');
        headline = `Brings in ${inc.length} toolkit${inc.length === 1 ? '' : 's'} or file${inc.length === 1 ? '' : 's'}.`;
        for (const i of inc) {
          const nm = i.replace(/^[<"]|[>"]$/g, '');
          const target = i.startsWith('"') ? ctx.fileOf(nm) : null;
          facts.push(target ? `[[${target}]] (another file in this project)` : CPP_LIBS[nm] ? `${code(nm)} (${CPP_LIBS[nm]})` : code(nm));
        }
        if (g.nodes.some(n => /using namespace std/.test(n.text))) {
          facts.push('`using namespace std` lets the code write `cout` instead of `std::cout`.');
          if (isHeader) add(F.warnings, '`using namespace std` in a header file affects every file that includes it, which can cause name clashes. Keep it in .cpp files.');
        }
      } else if (g.kind === 'settings') {
        const names = g.nodes.map(n => n.type === 'preproc_def' ? (n.childForFieldName('name') || n.namedChild(0)).text : (n.namedChildren.find(c => c.type === 'init_declarator') || n).text.split('=')[0].trim().replace(/[*&]/g, ''));
        headline = `Sets ${names.length} fixed value${names.length === 1 ? '' : 's'}: ${plainList(names.map(code))}.`;
        if (g.nodes.some(n => n.type === 'preproc_def')) facts.push('`#define` swaps text before compiling. A `constexpr` value does the same job but has a type the compiler can check.');
      } else if (g.kind === 'class') {
        const members = [...walk(g.fn)].filter(x => x.type === 'field_declaration' && !/\(/.test(x.text)).map(x => x.text.replace(/;$/, '').trim());
        const methods = [...walk(g.fn)].filter(x => (x.type === 'function_definition' || (x.type === 'field_declaration' && /\(/.test(x.text)))).map(x => cppName(x.type === 'function_definition' ? x : x));
        title = `${g.struct ? 'Struct' : 'Class'}: ${g.name}`;
        headline = g.struct ? `${code(g.name)} groups several values together into one thing.` : `${code(g.name)} is a class: a blueprint for making objects.`;
        if (members.length) facts.push('Each one keeps: ' + plainList(members.map(code), 8) + '.');
        if (methods.length) facts.push('It can: ' + plainList(methods.map(code), 8) + '.');
        if (/\bvirtual\b/.test(g.fn.text)) facts.push('`virtual` tools can be replaced by classes that build on this one.');
        if (/\bprivate\s*:/.test(g.fn.text)) facts.push('Some of its values are `private`: only its own tools can change them.');
      } else if (g.kind === 'declares') {
        headline = `Announces ${g.nodes.length} tool${g.nodes.length === 1 ? '' : 's'} that ${g.nodes.length === 1 ? 'is' : 'are'} written in full elsewhere (usually the matching .cpp file).`;
      } else if (['tool', 'start', 'arduino'].includes(g.kind)) {
        const params = cppParams(g.fn);
        const ret = cppType(g.fn);
        if (g.kind === 'start') { title = 'Starting point: main'; headline = 'Runs first when the program starts. The number it gives back tells the computer whether it worked (0 means yes).'; }
        else if (g.kind === 'arduino') { title = `Arduino: ${g.name}`; headline = g.name === 'setup' ? 'Runs once, when the board powers on or resets.' : 'Runs again and again, forever, after setup finishes.'; }
        else {
          title = `Tool: ${g.name}`;
          headline = `${code(g.name)} is a reusable tool that ${params.length ? 'takes ' + plainList(params.map(code)) : 'takes no inputs'}` + (ret && ret !== 'void' ? ` and gives back a ${code(ret)}.` : '.');
        }
        if (F.refs.length) facts.push(`${plainList(F.refs.map(code))} ${F.refs.length > 1 ? 'are references' : 'is a reference'} (the \`&\`): the tool changes the caller's own value, not a copy.`);
        if (F.crefs && F.crefs.length) facts.push(`${plainList(F.crefs.map(code))} ${F.crefs.length > 1 ? 'are read-only references' : 'is a read-only reference'} (\`const &\`): the tool looks at the caller's value without copying it, and can't change it.`);
        if (params.some(p => /\*/.test(p))) facts.push('It takes a pointer (the `*`): an address of a value, rather than the value itself.');
        if (note) facts.unshift('The comment above it says: ' + note);
        const b = g.fn.childForFieldName('body');
        body = b ? b.namedChildren : [];
        if (g.name === 'loop' && /delay\(\s*[1-9]\d{3,}/.test(g.fn.text)) add(F.warnings, 'Waits a long time with `delay` inside `loop`, so the board can\'t react to anything else during that time. `millis()` timing avoids this.');
      } else {
        headline = `${g.nodes.length} piece${g.nodes.length === 1 ? '' : 's'} of code outside any tool.`;
        body = g.nodes;
      }
      if (F.effects.length && g.kind !== 'imports') facts.push('Along the way it ' + plainList(F.effects, 6) + '.');
      const called = F.calls.filter(c => ctx.localFns && ctx.localFns.has(c) && c !== g.name);
      if (called.length) facts.push('Runs other tools: ' + plainList(called.map(code)) + '.');
      if (F.loops || F.decisions) facts.push('Contains ' + [F.loops ? `${F.loops} loop${F.loops > 1 ? 's' : ''}` : '', F.decisions ? `${F.decisions} decision${F.decisions > 1 ? 's' : ''}` : ''].filter(Boolean).join(' and ') + '.');
      if (F.news || F.deletes) facts.push('It manages memory by hand (`new`/`delete` or `malloc`/`free`).');
      const warnings = F.warnings.slice();
      if (['tool', 'start', 'arduino'].includes(g.kind) && end - start > 80) warnings.push(`This is ${end - start + 1} lines long. It may be doing several jobs that could be split up.`);
      for (let i = start - 1; i < end; i++) { const m = lines[i] && lines[i].match(/\/\/\s*(TODO|FIXME|HACK|XXX)\b:?\s*(.*)/); if (m) warnings.push(`Line ${i + 1} has a ${m[1]} note: ${m[2].trim() || '(no details)'}`); }
      const st = cppStepLines(body);
      sections.push({ id: id++, kind: g.kind === 'arduino' ? 'start' : g.kind === 'declares' ? 'settings' : g.kind, title, headline, facts, warnings: warnings.slice(0, 6), steps: st.steps, more: st.more, start, end, name: g.name || null, lang: 'cpp' });
    }
    if (allFacts.news > allFacts.deletes && sections.length) sections[0].warnings.push(`Reserves memory by hand ${allFacts.news} time${allFacts.news > 1 ? 's' : ''} but frees it only ${allFacts.deletes} time${allFacts.deletes === 1 ? '' : 's'}: a possible memory leak. Smart pointers (std::unique_ptr) or containers like std::vector free memory automatically.`);
    const isSketch = groups.some(g => g.kind === 'arduino');
    const fns = sections.filter(s => s.kind === 'tool').length, classes = sections.filter(s => s.kind === 'class').length;
    const overview = `${path} ` + (isSketch ? 'is an Arduino sketch' : groups.some(g => g.kind === 'start') ? 'is a C++ program' : isHeader ? 'is a C++ header: it announces tools and types that other files use' : 'holds C++ code') + (fns || classes ? `, with ${plainList([fns && `${fns} tool${fns > 1 ? 's' : ''}`, classes && `${classes} class${classes > 1 ? 'es' : ''}`].filter(Boolean))}.` : '.');
    return { ok: !rootNode.hasError(), error: rootNode.hasError() ? 'Some of this file could not be read.' : '', overview, sections, lines: lines.length, includes, isSketch, hasMain: groups.some(g => g.kind === 'start'), isHeader, libs: includes.filter(i => !i.local).map(i => i.name) };
  }

  /* ------------------------------------------------------------------ */
  /* A project: web files plus the Python reader's results               */
  /* ------------------------------------------------------------------ */

  const ROLE_LABEL = { sketch: 'Arduino sketch', header: 'Header', page: 'Web page', styles: 'Styles', components: 'Components', script: 'Page script', server: 'Web server', routes: 'Web routes', helpers: 'Helpers', settings: 'Settings', tests: 'Tests', package: 'Package marker', entry: 'Starting point', models: 'Data models' };

  function resolvePath(from, ref, paths) {
    if (!ref || /^(https?:)?\/\//.test(ref)) return null;
    const clean = ref.replace(/[?#].*$/, '');
    const baseDir = from.includes('/') ? from.slice(0, from.lastIndexOf('/') + 1) : '';
    const join = (a, b) => { const parts = (a + b).split('/'); const out = []; for (const p of parts) { if (p === '..') out.pop(); else if (p !== '.' && p !== '') out.push(p); } return out.join('/'); };
    const cands = clean.startsWith('/') ? paths.filter(p => p.endsWith(clean) || p.endsWith(clean.slice(1))) : [join(baseDir, clean)];
    for (const c of cands) for (const ext of ['', '.js', '.jsx', '.ts', '.tsx', '/index.js', '/index.jsx', '/index.ts', '/index.tsx']) if (paths.includes(c + ext)) return c + ext;
    // served from a static folder (e.g. Flask static/)
    const tail = clean.replace(/^\/+/, '');
    const hit = paths.filter(p => p.endsWith('/' + tail) || p === tail);
    return hit.length === 1 ? hit[0] : null;
  }

  function routePattern(p) {
    return new RegExp('^' + p.replace(/\/$/, '').replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/<[^>]+>|\{[^}]+\}|:\w+/g, '[^/]+') + '/?$');
  }

  /* files: [{name, source}] (web files only); py: the Python reader's project result or null */
  function analyzeProject(files, py) {
    const paths = files.map(f => f.name).concat(py ? py.files.map(f => f.path) : []);
    const results = [];
    const parsed = {};
    // 1. HTML first (others link to it)
    const htmlFiles = files.filter(f => kindOfPath(f.name) === 'html');
    const cssFiles = files.filter(f => kindOfPath(f.name) === 'css');
    const jsFiles = files.filter(f => /^(js|ts|tsx)$/.test(kindOfPath(f.name)));
    const cppFiles = files.filter(f => kindOfPath(f.name) === 'cpp');
    const htmlCtxBase = { fileOf: (ref, from) => resolvePath(from, ref, paths) };
    // routes from Python and Express
    const routes = [];
    if (py) for (const f of py.files) for (const s of (f.analysis.sections || [])) if (s.kind === 'route' && s.full_path) routes.push({ method: s.methods || ['GET'], path: s.full_path, file: f.path, name: s.name });
    const uses = [], fetches = [];
    // pre-parse HTML without cross links so JS and CSS can refer to it
    const htmlInfo = {};
    for (const f of htmlFiles) htmlInfo[f.name] = analyzeHtml(f.name, f.source, { ...htmlCtxBase, scriptsFor: () => [], stylesFor: () => [] });
    const htmlTargets = (sel) => {
      for (const [p, h] of Object.entries(htmlInfo)) {
        if (/^#[\w-]+$/.test(sel) && h.ids.includes(sel.slice(1))) return p;
        if (/^\.[\w-]+$/.test(sel) && h.classes.includes(sel.slice(1))) return p;
      }
      return null;
    };
    const htmlMatches = (sel) => {
      const simple = sel.replace(/::?[\w-]+(\([^)]*\))?/g, '').trim().split(/[\s>+~]+/).pop();
      if (!simple) return [];
      return Object.entries(htmlInfo).filter(([p, h]) => {
        const ids = simple.match(/#[\w-]+/g) || [], cls = simple.match(/\.[\w-]+/g) || [], tag = (simple.match(/^[a-z][a-z0-9]*/) || [])[0];
        return ids.every(i => h.ids.includes(i.slice(1))) && cls.every(c => h.classes.includes(c.slice(1))) && (!tag || h.tags.includes(tag)) && (ids.length || cls.length || tag);
      }).map(([p]) => p);
    };
    // JS: which files each file imports
    const jsImports = {};
    const routeFor = (method, url) => {
      const u = url.replace(/^https?:\/\/[^/]+/, '').replace(/\?.*$/, '').replace(/\{…\}/g, 'x');
      const hits = routes.filter(r => routePattern(r.path).test(u) && (r.method.includes(method) || r.method.includes('ALL')));
      return hits[0] ? { path: hits[0].file, name: hits[0].name || hits[0].path } : null;
    };
    // Express routes are found while reading JS; do a first pass to collect them
    for (const f of jsFiles) {
      const k = kindOfPath(f.name);
      try {
        const rootNode = parse(k, f.source);
        for (const n of rootNode.namedChildren) { const r = expressRoute(n); if (r) routes.push({ method: [r.method], path: r.path, file: f.name, name: `${r.method} ${r.path}` }); }
      } catch (_) { /* reported below */ }
    }
    const hasServer = routes.length > 0 || jsFiles.some(f => /express|http\.createServer/.test(f.source));
    const jsDom = {};  // path -> selectors used
    for (const f of jsFiles) {
      const k = kindOfPath(f.name);
      const xnames = {};
      // names imported from project files
      let a;
      try {
        const imps = importsOf(parse(k, f.source));
        jsImports[f.name] = [];
        for (const imp of imps) if (imp.source.startsWith('.') || imp.source.startsWith('/')) {
          const target = resolvePath(f.name, imp.source, paths);
          if (target) { jsImports[f.name].push(target); for (const nm of imp.names) xnames[nm] = target; }
        }
        a = analyzeJs(f.name, f.source, k, { path: f.name, xnames, uses, fetches, htmlTargets, routeFor, hasServer, fileOf: (ref) => resolvePath(f.name, ref, paths) });
      } catch (e) { a = { ok: false, error: 'Could not read this file: ' + e.message, sections: [], overview: '', lines: f.source.split('\n').length, libs: [] }; }
      parsed[f.name] = a;
      jsDom[f.name] = [...new Set((a.sections || []).flatMap(s => s.facts.filter(x => /^Works with/.test(x)).flatMap(x => (x.match(/`[#.][\w-]+`/g) || []).map(y => y.slice(1, -1)))))];
    }
    const scriptsFor = (sel) => Object.entries(jsDom).filter(([p, sels]) => sels.includes(sel)).map(([p]) => p);
    const cssByPath = {};
    for (const f of cssFiles) {
      let a;
      try { a = analyzeCss(f.name, f.source, { htmlMatches, hasHtml: htmlFiles.length > 0, scriptMentions: (s) => jsFiles.some(j => j.source.includes(s.slice(1))) }); }
      catch (e) { a = { ok: false, error: e.message, sections: [], overview: '', lines: 0, rules: [] }; }
      parsed[f.name] = a;
      cssByPath[f.name] = a.rules || [];
    }
    const stylesFor = (el, sub) => {
      const out = [];
      const ids = [el, ...sub].map(e => e.attrs.id).filter(Boolean), cls = [el, ...sub].flatMap(e => (e.attrs.class || '').split(/\s+/)).filter(Boolean);
      for (const [p, rules] of Object.entries(cssByPath)) for (const r of rules) for (const s of r.selectors) {
        const last = s.split(/[\s>+~]+/).pop().replace(/:.*$/, '');
        if ((last.startsWith('#') && ids.includes(last.slice(1))) || (last.startsWith('.') && cls.includes(last.slice(1)))) if (!out.some(o => o.selector === s)) out.push({ selector: s, path: p });
      }
      return out;
    };
    for (const f of htmlFiles) parsed[f.name] = analyzeHtml(f.name, f.source, { ...htmlCtxBase, scriptsFor, stylesFor });
    const cppFns = new Set();
    for (const f of cppFiles) for (const m of f.source.matchAll(/^[\w:<>*&\s]+?\b(\w+)\s*\([^;{]*\)\s*(?:const\s*)?\{/gm)) cppFns.add(m[1]);
    for (const f of cppFiles) {
      try { parsed[f.name] = analyzeCpp(f.name, f.source, { fileOf: (ref) => resolvePath(f.name, ref, paths), localFns: cppFns }); }
      catch (e) { parsed[f.name] = { ok: false, error: 'Could not read this file: ' + e.message, sections: [], overview: '', lines: f.source.split('\n').length, libs: [] }; }
    }

    // 2. roles, edges, summaries
    const edges = [];
    for (const f of files) {
      const kind = kindOfPath(f.name);
      const a = parsed[f.name];
      if (!a) continue;
      let role, summary, imports = [];
      if (kind === 'cpp') {
        role = a.isSketch ? 'sketch' : a.hasMain ? 'entry' : a.isHeader ? 'header' : 'helpers';
        imports = (a.includes || []).filter(i => i.local).map(i => resolvePath(f.name, i.name, paths)).filter(Boolean);
        const tools = (a.sections || []).filter(s => s.kind === 'tool').map(s => s.name);
        summary = role === 'sketch' ? 'Arduino sketch: setup and loop' : role === 'entry' ? 'Starts the program (main)' : role === 'header' ? 'Announces tools and types for other files' : tools.length ? 'Tools: ' + plainList(tools.map(code), 4) : `${(a.sections || []).length} sections`;
      } else if (kind === 'html') {
        role = 'page';
        imports = [...a.scripts, ...a.styles].map(r => resolvePath(f.name, r, paths)).filter(Boolean);
        summary = a.overview.replace(f.name + ' is ', '').replace(/^./, c => c.toUpperCase());
      } else if (kind === 'css') {
        role = 'styles';
        summary = `${(a.rules || []).length} style rules`;
      } else {
        const kinds = (a.sections || []).map(s => s.kind);
        const name = f.name.split('/').pop();
        role = /\.(test|spec)\.[jt]sx?$/.test(name) || /(^|\/)(__tests__|tests?)\//.test(f.name) ? 'tests'
          : kinds.includes('route') || /express|http\.createServer|fastify/.test(f.source) ? (kinds.includes('route') ? 'routes' : 'server')
          : kinds.includes('component') ? 'components'
          : /(config|settings|constants)\.[jt]sx?$/.test(name) || kinds.every(k => ['imports', 'settings'].includes(k)) ? 'settings'
          : /document\.|window\./.test(f.source) ? 'script' : 'helpers';
        imports = jsImports[f.name] || [];
        const comps = (a.sections || []).filter(s => s.kind === 'component').map(s => s.name);
        const tools = (a.sections || []).filter(s => s.kind === 'tool').map(s => s.name);
        summary = role === 'components' ? 'Components: ' + plainList(comps.map(code), 4) : role === 'routes' ? `${kinds.filter(k => k === 'route').length} web routes` : tools.length ? 'Tools: ' + plainList(tools.map(code), 4) : `${(a.sections || []).length} sections`;
      }
      for (const t of imports) edges.push([f.name, t]);
      results.push({ path: f.name, module: f.name, role, role_label: ROLE_LABEL[role], summary, imports, imported_by: [], analysis: { ok: a.ok, error: a.error, overview: a.overview, sections: a.sections || [], lines: a.lines }, libs: a.libs || [], lines: a.lines, lang: kind });
    }
    // front end -> back end
    for (const ft of fetches) if (ft.route) edges.push([ft.from, ft.route.path]);
    // "used in other files"
    for (const [src, dst, name] of uses) {
      const r = results.find(x => x.path === dst);
      const s = r && r.analysis.sections.find(x => x.name === name);
      if (s) { const fact = `Used in other files: [[${src}]].`; if (!s.facts.includes(fact)) s.facts.splice(1, 0, fact); }
    }
    // routes answered: add "called by" to Python route sections
    const calledBy = {};
    for (const ft of fetches) if (ft.route) (calledBy[ft.route.path + '#' + ft.route.name] = calledBy[ft.route.path + '#' + ft.route.name] || new Set()).add(ft.from);
    return { files: results, edges, routes, fetches, calledBy: Object.fromEntries(Object.entries(calledBy).map(([k, v]) => [k, [...v]])), hasServer };
  }

  const api = { init, loadLangs, analyzeCpp, kindOfPath, analyzeJs: (p, s, k, c) => analyzeJs(p, s, k || kindOfPath(p), c), analyzeHtml, analyzeCss, analyzeProject, colorName, describeDecl, ROLE_LABEL, ready: () => !!TS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.IntuiWebReader = api;
})(typeof window !== 'undefined' ? window : globalThis);

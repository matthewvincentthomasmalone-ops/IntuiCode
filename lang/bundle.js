/* A Vite app (React, and Lovable's projects) run in the browser version, which can't start its dev server:
 * esbuild (as WebAssembly, in the page) builds its code into one module from the project's files, and the
 * packages it brings in (react, react-dom, @tanstack/react-query …) load from esm.sh at the versions its
 * package.json names, through an import map. The desktop app runs the project's own dev server instead.
 *
 * What it does as Vite would: index.html's module script is the start; "@/…" is src/… (or the paths tsconfig
 * says); .tsx, .ts, .jsx and .js are found without their endings, and folders by their index file; CSS a file
 * brings in is put in the page; import.meta.env has MODE, DEV, PROD, BASE_URL and the VITE_ settings in .env.
 * Tailwind (an @tailwind line, or @import "tailwindcss") is run by its Play CDN with the project's
 * tailwind.config, so its classes and @apply work.
 * What it can't: packages that need Node, files that aren't text (pictures stay out, with a warning), and
 * anything vite.config adds by plugins.
 *   IntuiBundle.viteApp(files, esbuild) -> Promise<{ html, errors, warnings, packages }>
 *     files: { "index.html": text, "src/main.tsx": text, "package.json": text, … }
 *     esbuild: esbuild-wasm's API, initialized (browser: esbuild.initialize({ wasmURL }))
 */
(function (root) {
  'use strict';

  const CDN = 'https://esm.sh/';
  const TAILWIND_CDN = 'https://cdn.tailwindcss.com/3.4.17';
  const ENDINGS = ['.tsx', '.ts', '.jsx', '.js', '.mjs', '.json', '.css'];
  const SHARED = ['react', 'react-dom'];   // (one copy of each, whoever brings it in)
  const REACT_PARTS = ['react', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-dom', 'react-dom/client'];

  const json = (t) => { try { return JSON.parse(String(t || '').replace(/^﻿/, '').replace(/\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm, '').replace(/,(\s*[}\]])/g, '$1')); } catch (_) { return null; } };
  const dirOf = (p) => p.split('/').slice(0, -1).join('/');
  const norm = (p) => {
    const out = [];
    for (const seg of p.split('/')) { if (seg === '..') out.pop(); else if (seg && seg !== '.') out.push(seg); }
    return out.join('/');
  };

  /* The start of the app: index.html's <script type="module" src="…">. -> { path, tag } or null */
  function entryOf(html) {
    for (const m of String(html || '').matchAll(/<script\b[^>]*>\s*<\/script>/gi)) {
      const tag = m[0];
      if (!/\btype\s*=\s*["']?module\b/i.test(tag)) continue;
      const src = tag.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
      if (src && !/^(?:[a-z]+:)?\/\//i.test(src[1])) return { path: norm(src[1].replace(/^\//, '')), tag };
    }
    return null;
  }

  /* The project's aliases ("@/*": ["./src/*"] in tsconfig's paths), as [from prefix, to prefix]; "@/" is src/
     when nothing says (Vite projects set it in vite.config). */
  function aliasesOf(files) {
    const out = [];
    for (const f of ['tsconfig.json', 'tsconfig.app.json', 'jsconfig.json']) {
      const paths = ((json(files[f]) || {}).compilerOptions || {}).paths || {};
      for (const [k, v] of Object.entries(paths)) if (/\*$/.test(k) && Array.isArray(v) && typeof v[0] === 'string' && /\*$/.test(v[0])) out.push([k.slice(0, -1), norm(v[0].slice(0, -1)) + '/']);
    }
    if (!out.some(([k]) => k === '@/')) out.push(['@/', 'src/']);
    return out;
  }

  /* A package a file brings in ("react-dom/client", "@tanstack/react-query"): its name and the rest. */
  function splitPackage(spec) {
    const parts = spec.split('/');
    const n = spec.startsWith('@') ? 2 : 1;
    return { name: parts.slice(0, n).join('/'), sub: parts.slice(n).join('/') };
  }

  /* Where a package loads from: esm.sh, at the version package.json says (^1.2.3 is 1.2.3 or later in 1.x, and
     esm.sh picks the latest of those). React and React DOM are left to the import map, so there is one of each. */
  function packageUrl(spec, versions) {
    const { name, sub } = splitPackage(spec);
    const v = String(versions[name] || '').trim();
    const at = /^(?:\^|~|>=?)?\d/.test(v) ? '@' + v.replace(/^>=?/, '') : '';
    const keep = SHARED.includes(name) ? (name === 'react' ? '' : '?external=react') : '?external=' + SHARED.join(',');
    return `${CDN}${name}${at}${sub ? '/' + sub : ''}${keep}`;
  }

  /* VITE_ settings from .env files, for import.meta.env */
  function envOf(files) {
    const env = { MODE: 'development', DEV: true, PROD: false, SSR: false, BASE_URL: '/' };
    for (const f of ['.env', '.env.local', '.env.development', '.env.development.local']) {
      for (const line of String(files[f] || '').split(/\r?\n/)) {
        const m = line.match(/^\s*(VITE_[A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
        if (m) env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
      }
    }
    return env;
  }

  async function viteApp(files, esbuild) {
    const errors = [], warnings = [];
    const html = files['index.html'];
    if (html == null) return { html: null, errors: ['There is no index.html at the top of the project, so there\'s no page to start from.'], warnings, packages: [] };
    const entry = entryOf(html);
    if (!entry) return { html: null, errors: ['index.html has no <script type="module" src="…"> to start the app from.'], warnings, packages: [] };
    if (files[entry.path] == null) return { html: null, errors: [`index.html starts the app with ${entry.path}, which isn't in the project.`], warnings, packages: [] };
    const pkg = json(files['package.json']) || {};
    const versions = { ...(pkg.devDependencies || {}), ...(pkg.peerDependencies || {}), ...(pkg.dependencies || {}) };
    const aliases = aliasesOf(files);
    const packages = new Set(), styles = new Set();
    const find = (p) => {
      if (files[p] != null) return p;
      for (const e of ENDINGS) if (files[p + e] != null) return p + e;
      for (const e of ENDINGS) if (files[p + '/index' + e] != null) return p + '/index' + e;
      return null;
    };
    const loaderOf = (p) => (/\.tsx$/.test(p) ? 'tsx' : /\.ts$/.test(p) ? 'ts' : /\.jsx$/.test(p) ? 'jsx' : /\.(?:m?js|cjs)$/.test(p) ? 'js' : /\.json$/.test(p) ? 'json' : /\.css$/.test(p) ? 'css' : /\.svg$/.test(p) ? 'dataurl' : 'text');
    const plugin = {
      name: 'intuacode-project',
      setup(b) {
        b.onResolve({ filter: /.*/ }, (a) => {
          let spec = a.path.replace(/[?#].*$/, '');
          if (a.kind === 'entry-point') return { path: spec, namespace: 'project' };
          const alias = aliases.find(([k]) => spec.startsWith(k));
          let p = null;
          if (alias) p = alias[1] + spec.slice(alias[0].length);
          else if (/^\.\.?\//.test(spec)) p = norm(dirOf(a.importer) + '/' + spec);
          else if (spec.startsWith('/')) p = norm(spec.slice(1));
          if (p != null) {
            const at = find(norm(p));
            if (at) return { path: at, namespace: 'project' };
            if (/\.(?:png|jpe?g|gif|webp|ico|avif|mp3|wav|ogg|mp4|woff2?|ttf|otf)$/i.test(p)) { warnings.push(`${a.importer} brings in ${spec}, which isn't text, so it's left out of the preview.`); return { path: p, namespace: 'empty' }; }
            errors.push(`${a.importer} brings in "${a.path}", but there's no ${p} in the project.`);
            return { path: p, namespace: 'empty' };
          }
          // a package: CSS from it goes in the page as a link, its code loads from esm.sh
          if (/\.css$/i.test(spec)) { styles.add(packageUrl(spec, versions).replace(/\?.*$/, '')); return { path: spec, namespace: 'empty' }; }
          packages.add(spec);
          return { path: spec, external: true };
        });
        b.onLoad({ filter: /.*/, namespace: 'project' }, (a) => ({ contents: files[a.path], loader: loaderOf(a.path), resolveDir: '/' + dirOf(a.path) }));
        b.onLoad({ filter: /.*/, namespace: 'empty' }, () => ({ contents: '', loader: 'js' }));
      },
    };
    let out;
    try {
      out = await esbuild.build({
        entryPoints: [entry.path], bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2020',
        jsx: 'automatic', outdir: 'out', plugins: [plugin], logLevel: 'silent', charset: 'utf8',
        define: { 'import.meta.env': JSON.stringify(envOf(files)), 'process.env.NODE_ENV': '"development"' },
      });
    } catch (e) {
      for (const m of (e && e.errors) || [{ text: String(e && e.message || e) }]) errors.push(m.location ? `${m.location.file.replace(/^project:/, '')}:${m.location.line}: ${m.text}` : m.text);
      return { html: null, errors, warnings, packages: [...packages] };
    }
    if (errors.length) return { html: null, errors, warnings, packages: [...packages] };
    const js = (out.outputFiles.find(f => /\.js$/.test(f.path)) || { text: '' }).text;
    let css = (out.outputFiles.find(f => /\.css$/.test(f.path)) || { text: '' }).text;
    // the import map: each package the code brings in, and, when it uses React, React's own parts, which the
    // packages from esm.sh bring in by name (so all of them share one React)
    const imports = {};
    for (const spec of packages) imports[spec] = packageUrl(spec, versions);
    if ([...packages].some(p => SHARED.includes(splitPackage(p).name)) || versions.react) for (const spec of REACT_PARTS) imports[spec] ||= packageUrl(spec, versions);
    // Tailwind, run in the page by its Play CDN with the project's config
    const tailwind = Object.entries(files).some(([p, t]) => /\.css$/.test(p) && /@tailwind\b|@import\s+["']tailwindcss["']/.test(t));
    let twConfig = '';
    if (tailwind) {
      const cf = ['tailwind.config.ts', 'tailwind.config.js', 'tailwind.config.mjs', 'tailwind.config.cjs'].find(f => files[f] != null);
      if (cf) {
        try {
          const t = await esbuild.transform(files[cf], { loader: /\.ts$/.test(cf) ? 'ts' : 'js', format: 'cjs', target: 'es2020' });
          twConfig = `<script>(function(){var module={exports:{}},exports=module.exports;var require=function(){return{handler:function(){}}};\n${t.code}\nvar c=module.exports&&module.exports.default||module.exports;delete c.content;tailwind.config=c;})();</script>`;
        } catch (e) { warnings.push(`${cf} couldn't be read, so Tailwind runs with its own settings.`); }
      }
      css = css.replace(/@tailwind\s+[\w-]+;?|@import\s+["']tailwindcss["'];?/g, '');
    }
    const esc = (t) => t.replace(/<\/(script|style)/gi, '<\\/$1');
    const head = [
      `<script type="importmap">${JSON.stringify({ imports })}</script>`,
      ...[...styles].map(u => `<link rel="stylesheet" href="${u}">`),
      ...(tailwind ? [`<script src="${TAILWIND_CDN}"></script>`, twConfig] : []),
      css.trim() ? `<style${tailwind ? ' type="text/tailwindcss"' : ''}>\n${esc(css)}</style>` : '',
    ].filter(Boolean).join('\n');
    let page = html.replace(entry.tag, () => `<script type="module">\n${esc(js)}</script>`);
    page = /<head\b[^>]*>/i.test(page) ? page.replace(/<head\b[^>]*>/i, (m) => `${m}\n${head}`) : head + '\n' + page;
    return { html: page, errors, warnings, packages: [...packages].sort() };
  }

  const api = { viteApp, entryOf, aliasesOf, packageUrl, envOf, CDN };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.IntuiBundle = api;
})(typeof window !== 'undefined' ? window : globalThis);

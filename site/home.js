/* IntuaCode's home page: the download buttons, from downloads.json (the newest release's files and their
   SHA-256, written when the site is built by tools/build_site.mjs). No other requests. */
(function () {
  'use strict';

  const RELEASES = 'https://github.com/matthewvincentthomasmalone-ops/IntuiCode/releases';
  const SYSTEMS = [
    { os: 'windows', name: 'Windows', about: 'Windows 10 and 11, 64-bit' },
    { os: 'linux', name: 'Linux', about: 'Ubuntu, Debian, Mint, Fedora and more, 64-bit' },
    { os: 'mac', name: 'macOS', about: 'Apple Silicon and Intel' },
  ];
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const mb = (n) => (n >= 1e6 ? (n / 1e6).toFixed(n >= 1e8 ? 0 : 1) + ' MB' : Math.max(1, Math.round(n / 1e3)) + ' KB');

  // The computer this page is open on, as well as a browser can tell
  function thisSystem() {
    const p = ((navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '').toLowerCase();
    const ua = navigator.userAgent.toLowerCase();
    if (/android|iphone|ipad|ipod/.test(ua)) return 'phone';
    if (/win/.test(p) || /windows/.test(ua)) return 'windows';
    if (/mac/.test(p) || /mac os/.test(ua)) return 'mac';
    if (/linux|x11|cros/.test(p) || /linux|x11/.test(ua)) return 'linux';
    return '';
  }

  function fileRow(f) {
    return `<li class="file"><a class="get" href="${esc(f.url)}" rel="noopener" download>${esc(f.label)}</a><span class="size">${esc(mb(f.size))}</span>`
      + `<span class="what">${esc(f.name)}</span>`
      + (f.sha256 ? `<span class="sha"><code title="SHA-256 of ${esc(f.name)}">SHA-256 ${esc(f.sha256)}</code><button type="button" class="copy" data-copy="${esc(f.sha256)}">Copy</button></span>` : '')
      + '</li>';
  }

  function render(rel) {
    const mine = thisSystem(), grid = $('dlGrid');
    const files = (rel && Array.isArray(rel.files)) ? rel.files : [];
    if (rel && rel.page) $('allRel').href = rel.page.replace(/\/tag\/[^/]+$/, '');
    if (!files.length) {
      grid.innerHTML = `<p class="dl-empty">The downloads are on <a href="${RELEASES}" rel="noopener">GitHub</a>.</p>`;
      $('dlMain').href = RELEASES;
      return;
    }
    $('relInfo').textContent = `Version ${rel.version}${rel.published ? `, ${new Date(rel.published).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}` : ''}. The desktop app works offline and on real folders.`;
    const order = SYSTEMS.slice().sort((a, b) => (b.os === mine) - (a.os === mine));
    grid.innerHTML = order.map(s => {
      const list = files.filter(f => f.os === s.os);
      if (!list.length) return '';
      return `<article class="dl${s.os === mine ? ' mine' : ''}" id="dl-${s.os}"><div class="dl-h"><h3>${s.name}</h3><span>${esc(s.about)}</span></div><ul>${list.map(fileRow).join('')}</ul></article>`;
    }).join('');
    // the main key: the installer for this computer, or the list
    const main = files.find(f => f.os === mine && f.main);
    if (main) {
      $('dlMain').href = main.url;
      $('dlMain').setAttribute('download', '');
      $('dlMainLabel').textContent = `Download for ${SYSTEMS.find(s => s.os === mine).name}`;
      const others = SYSTEMS.filter(s => s.os !== mine && files.some(f => f.os === s.os)).map(s => `<a href="#dl-${s.os}">${s.name}</a>`);
      $('dlNote').innerHTML = `Version ${esc(rel.version)}, ${esc(mb(main.size))}.${others.length ? ` Also for ${others.join(' and ')}.` : ''} Or <a href="app/">open it in your browser</a>: nothing to install.`;
    } else if (mine === 'phone') {
      $('dlNote').textContent = 'IntuaCode is made for a computer. The browser version works on a tablet, with a keyboard.';
    }
  }

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-copy]');
    if (!b || !navigator.clipboard) return;
    navigator.clipboard.writeText(b.dataset.copy).then(() => { b.textContent = 'Copied'; setTimeout(() => { b.textContent = 'Copy'; }, 1500); }, () => {});
  });

  fetch('downloads.json', { cache: 'no-cache' }).then(r => (r.ok ? r.json() : null)).catch(() => null).then(render);
})();

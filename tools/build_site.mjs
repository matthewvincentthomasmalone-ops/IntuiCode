// Assemble the website (intuacode.com) into _site/:
//   /                 the home page (site/), with the fonts
//   /app/             the browser version: dist/, from tools/build_desktop.mjs (run it first)
//   /downloads.json   the newest release's installers, sizes and SHA-256, for the home page's buttons
//   /.well-known/security.txt   how to report a security problem (RFC 9116), dated from this build
// The release is read from GitHub's API (GITHUB_TOKEN if there is one). Without it the home page links to
// the releases page instead, so the site still builds offline.
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, '_site'), DIST = path.join(ROOT, 'dist');
const REPO = process.env.GITHUB_REPOSITORY || 'matthewvincentthomasmalone-ops/IntuiCode';
const SITE_URL = 'https://intuacode.com';

if (!existsSync(path.join(DIST, 'index.html'))) {
  console.error('error: dist/ is missing. Run: node tools/build_desktop.mjs');
  process.exit(1);
}
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
cpSync(path.join(ROOT, 'site'), OUT, { recursive: true });
cpSync(path.join(ROOT, 'fonts'), path.join(OUT, 'fonts'), { recursive: true });
cpSync(DIST, path.join(OUT, 'app'), { recursive: true });

/* What each installer is, from its name (Tauri's bundle names). `main` is the one the big button gives. */
const KINDS = [
  [/-setup\.exe$/i, 'windows', 'Installer (.exe)', true],
  [/\.msi$/i, 'windows', 'Installer for managed PCs (.msi)', false],
  [/\.AppImage$/i, 'linux', 'AppImage: runs on most Linux', true],
  [/\.deb$/i, 'linux', 'Ubuntu, Debian, Mint (.deb)', false],
  [/\.rpm$/i, 'linux', 'Fedora, openSUSE (.rpm)', false],
  [/\.dmg$/i, 'mac', 'Disk image (.dmg)', true],
];

async function releaseInfo() {
  const headers = { accept: 'application/vnd.github+json', 'user-agent': 'intuacode-site-build', 'x-github-api-version': '2022-11-28' };
  if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=20`, { headers });
  if (!res.ok) throw new Error(`GitHub said ${res.status} ${res.statusText}`);
  // the newest published release with installers (a pre-release counts: they all are, while unsigned)
  const rel = (await res.json()).filter(r => !r.draft && r.assets.some(a => KINDS.some(([re]) => re.test(a.name))))
    .sort((a, b) => new Date(b.published_at) - new Date(a.published_at))[0];
  if (!rel) throw new Error('no release with installers yet');
  const files = [];
  for (const a of rel.assets) {
    const kind = KINDS.find(([re]) => re.test(a.name));
    if (!kind) continue;
    const digest = typeof a.digest === 'string' && a.digest.startsWith('sha256:') ? a.digest.slice(7) : null;
    files.push({ os: kind[1], label: kind[2], main: kind[3], name: a.name, url: a.browser_download_url, size: a.size, sha256: digest });
  }
  files.sort((a, b) => KINDS.findIndex(([re]) => re.test(a.name)) - KINDS.findIndex(([re]) => re.test(b.name)));   // the main one first
  const sums = rel.assets.find(a => /^SHA256SUMS(\.txt)?$/i.test(a.name));
  return { version: rel.tag_name.replace(/^v/, ''), tag: rel.tag_name, published: rel.published_at, page: rel.html_url, prerelease: rel.prerelease, sums: sums ? sums.browser_download_url : null, files };
}

let info;
try {
  info = await releaseInfo();
  console.log(`Downloads: ${info.tag}, ${info.files.length} installers${info.files.every(f => f.sha256) ? ' with checksums' : ''}.`);
} catch (e) {
  console.warn(`warning: no release information (${e.message}), so the home page links to the releases page.`);
  info = { version: null, page: `https://github.com/${REPO}/releases`, files: [] };
}
writeFileSync(path.join(OUT, 'downloads.json'), JSON.stringify(info, null, 2) + '\n');

// security.txt must say when it stops being valid (at most a year): six months from each build
const expires = new Date(Date.now() + 182 * 24 * 3600 * 1000).toISOString().replace(/\.\d+Z$/, '.000Z');
mkdirSync(path.join(OUT, '.well-known'), { recursive: true });
writeFileSync(path.join(OUT, '.well-known', 'security.txt'), [
  `Contact: https://github.com/${REPO}/security/advisories/new`,
  `Expires: ${expires}`,
  `Policy: https://github.com/${REPO}/blob/main/SECURITY.md`,
  'Preferred-Languages: en',
  `Canonical: ${SITE_URL}/.well-known/security.txt`,
  '',
].join('\n'));

console.log('Website ready in _site/ (the home page, app/, downloads.json, .well-known/security.txt)');

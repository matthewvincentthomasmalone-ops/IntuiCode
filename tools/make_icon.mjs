// Draws the app icon, a vintage terminal with "IntuiCode>" on its screen, as src-tauri/icons/source.svg.
// The letters are a 5×7 pixel font drawn as squares, so the icon doesn't depend on any installed font.
// Then: npm run tauri -- icon src-tauri/icons/source.svg   (makes every size, and the .ico and .icns)
// The Windows build only embeds a new icon.ico when src-tauri/tauri.conf.json has changed since the last
// build (that's what reruns its build script), so touch that file before building again.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const FONT = {
  I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
  n: ['.....', '.....', '#.##.', '##..#', '#...#', '#...#', '#...#'],
  t: ['.#...', '.#...', '####.', '.#...', '.#...', '.#..#', '..##.'],
  u: ['.....', '.....', '#...#', '#...#', '#...#', '#..##', '.##.#'],
  i: ['..#..', '.....', '.##..', '..#..', '..#..', '..#..', '.###.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  o: ['.....', '.....', '.###.', '#...#', '#...#', '#...#', '.###.'],
  d: ['....#', '....#', '.##.#', '#..##', '#...#', '#...#', '.####'],
  e: ['.....', '.....', '.###.', '#...#', '#####', '#....', '.###.'],
  '>': ['.#...', '..#..', '...#.', '....#', '...#.', '..#..', '.#...'],
  '█': ['#####', '#####', '#####', '#####', '#####', '#####', '#####'],
};
const TEXT = 'IntuiCode>';

// The screen, and the text centred on it
const SCREEN = { x: 116, y: 176, w: 792, h: 472, r: 64 };
const cols = (TEXT.length + 1) * 6 - 1;           // (+1: the cursor after the >)
const S = 11.2;                                   // one pixel of the font
const tx = SCREEN.x + (SCREEN.w - cols * S) / 2;
const ty = SCREEN.y + (SCREEN.h - 7 * S) / 2;

// Each lit pixel is wider than it is tall: phosphor blooms sideways along the scan, which also makes the
// letters bold enough to read at small sizes. (The cursor is drawn apart, dimmer.)
function glyphs(grow) {
  let out = '';
  [...TEXT].forEach((ch, k) => {
    FONT[ch].forEach((row, y) => [...row].forEach((on, x) => {
      if (on !== '#') return;
      const px = tx + (k * 6 + x) * S - grow / 2, py = ty + y * S - grow / 4;
      out += `<rect x="${px.toFixed(1)}" y="${py.toFixed(1)}" width="${(S * 1.45 + grow).toFixed(1)}" height="${(S * 0.94 + grow / 2).toFixed(1)}" rx="2"/>`;
    }));
  });
  return out;
}
const cursorOnly = () => {
  const k = TEXT.length;
  return `<rect x="${(tx + k * 6 * S).toFixed(1)}" y="${ty.toFixed(1)}" width="${(5 * S - 1.4).toFixed(1)}" height="${(7 * S - 1.4).toFixed(1)}" rx="2"/>`;
};

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    <linearGradient id="case" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FCF1F3"/><stop offset=".55" stop-color="#F5DCE2"/><stop offset="1" stop-color="#E6BCC7"/>
    </linearGradient>
    <linearGradient id="bezel" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#C98E9E"/><stop offset="1" stop-color="#EBCBD3"/>
    </linearGradient>
    <linearGradient id="stand" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#E9C4CD"/><stop offset="1" stop-color="#D3A2AF"/>
    </linearGradient>
    <radialGradient id="crt" cx=".5" cy=".46" r=".68">
      <stop offset="0" stop-color="#143A28"/><stop offset=".62" stop-color="#0A2117"/><stop offset="1" stop-color="#030A07"/>
    </radialGradient>
    <linearGradient id="glare" x1="0" y1="0" x2=".7" y2="1">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity=".16"/><stop offset=".45" stop-color="#FFFFFF" stop-opacity=".03"/><stop offset=".46" stop-color="#FFFFFF" stop-opacity="0"/>
    </linearGradient>
    <pattern id="scan" width="8" height="8" patternUnits="userSpaceOnUse">
      <rect width="8" height="2.5" fill="#000" fill-opacity=".24"/>
    </pattern>
    <radialGradient id="led" cx=".4" cy=".35" r=".7">
      <stop offset="0" stop-color="#FFE9A8"/><stop offset=".5" stop-color="#F2B640"/><stop offset="1" stop-color="#B9790F"/>
    </radialGradient>
    <filter id="wide" x="-20%" y="-60%" width="140%" height="220%"><feGaussianBlur stdDeviation="22"/></filter>
    <filter id="near" x="-10%" y="-40%" width="120%" height="180%"><feGaussianBlur stdDeviation="5"/></filter>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="160%"><feGaussianBlur stdDeviation="14"/></filter>
    <clipPath id="screen"><rect x="${SCREEN.x}" y="${SCREEN.y}" width="${SCREEN.w}" height="${SCREEN.h}" rx="${SCREEN.r}"/></clipPath>
  </defs>

  <!-- shadow on the desk -->
  <ellipse cx="512" cy="948" rx="380" ry="30" fill="#5B1426" opacity=".28" filter="url(#soft)"/>

  <!-- stand -->
  <path d="M404 800 L620 800 L652 874 L372 874 Z" fill="url(#stand)" stroke="#5B1426" stroke-width="22" stroke-linejoin="round"/>
  <rect x="252" y="862" width="520" height="66" rx="30" fill="url(#stand)" stroke="#5B1426" stroke-width="22"/>
  <rect x="284" y="876" width="456" height="10" rx="5" fill="#FFF6F8" opacity=".6"/>

  <!-- the terminal's case -->
  <rect x="44" y="96" width="936" height="728" rx="112" fill="url(#case)" stroke="#5B1426" stroke-width="24"/>
  <rect x="72" y="120" width="880" height="680" rx="92" fill="none" stroke="#FFFFFF" stroke-opacity=".75" stroke-width="6"/>

  <!-- the bezel, set into the case -->
  <rect x="${SCREEN.x - 36}" y="${SCREEN.y - 34}" width="${SCREEN.w + 72}" height="${SCREEN.h + 68}" rx="${SCREEN.r + 30}" fill="url(#bezel)" stroke="#8E4A5C" stroke-width="5"/>

  <!-- the screen: a dark, slightly curved glass with green phosphor -->
  <rect x="${SCREEN.x}" y="${SCREEN.y}" width="${SCREEN.w}" height="${SCREEN.h}" rx="${SCREEN.r}" fill="url(#crt)"/>
  <g clip-path="url(#screen)">
    <g fill="#39F59B" opacity=".6" filter="url(#wide)">${glyphs(8)}${cursorOnly()}</g>
    <g fill="#62FFB6" filter="url(#near)">${glyphs(3)}</g>
    <g fill="#EAFFF4">${glyphs(0)}</g>
    <g fill="#9CFFD0" opacity=".55">${cursorOnly()}</g>
    <rect x="${SCREEN.x}" y="${SCREEN.y}" width="${SCREEN.w}" height="${SCREEN.h}" fill="url(#scan)"/>
    <rect x="${SCREEN.x}" y="${SCREEN.y}" width="${SCREEN.w}" height="${SCREEN.h}" fill="url(#glare)"/>
  </g>
  <rect x="${SCREEN.x}" y="${SCREEN.y}" width="${SCREEN.w}" height="${SCREEN.h}" rx="${SCREEN.r}" fill="none" stroke="#020605" stroke-width="10"/>

  <!-- vents and the power light -->
  <g fill="#5B1426" opacity=".55">
    <rect x="132" y="722" width="150" height="14" rx="7"/>
    <rect x="132" y="752" width="150" height="14" rx="7"/>
  </g>
  <circle cx="872" cy="742" r="36" fill="#F2B640" opacity=".35" filter="url(#near)"/>
  <circle cx="872" cy="742" r="20" fill="url(#led)" stroke="#5B1426" stroke-width="7"/>
</svg>
`;

const out = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src-tauri/icons/source.svg');
writeFileSync(process.argv[2] || out, svg);
console.log('wrote', process.argv[2] || out);

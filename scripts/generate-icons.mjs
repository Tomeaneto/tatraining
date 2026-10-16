// Gera os ícones do PWA a partir da geometria do <TALogo /> (src/brand/logo.json).
// Uso: npm run icons
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = new URL('..', import.meta.url);
const logo = JSON.parse(await readFile(new URL('src/brand/logo.json', root), 'utf8'));
const outDir = new URL('public/icons/', root);
await mkdir(outDir, { recursive: true });

const u = logo.underline;
const mark = `
  <defs>
    <linearGradient id="s" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${logo.silverFrom}"/>
      <stop offset="100%" stop-color="${logo.silverTo}"/>
    </linearGradient>
  </defs>
  <path d="${logo.t}" fill="url(#s)"/>
  <path d="${logo.a}" fill="url(#s)" fill-rule="evenodd"/>
  <rect x="${u.x}" y="${u.y}" width="${u.width}" height="${u.height}" rx="${u.rx}" fill="${logo.gold}"/>`;

// Logo transparente (favicon)
await writeFile(
  new URL('logo.svg', outDir),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${logo.viewBox}">${mark}</svg>\n`,
);

// Ícone sobre fundo preto; `scale` controla a margem (maskable precisa de mais respiro).
function iconSvg(scale) {
  const offset = (118 * (1 - scale)) / 2;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 118 118">
      <rect width="118" height="118" fill="#080808"/>
      <g transform="translate(${offset} ${offset}) scale(${scale})">${mark}</g>
    </svg>`,
  );
}

const targets = [
  { file: 'icon-192.png', size: 192, scale: 0.8 },
  { file: 'icon-512.png', size: 512, scale: 0.8 },
  { file: 'icon-512-maskable.png', size: 512, scale: 0.62 },
  { file: 'apple-touch-icon.png', size: 180, scale: 0.74 },
];

for (const t of targets) {
  await sharp(iconSvg(t.scale), { density: 600 })
    .resize(t.size, t.size)
    .png()
    .toFile(fileURLToPath(new URL(t.file, outDir)));
  console.log(`✓ ${t.file}`);
}

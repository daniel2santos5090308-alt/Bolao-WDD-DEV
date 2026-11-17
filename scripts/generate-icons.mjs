// Gera os icones do app instalavel (Fase 8) a partir da marca "WDD" do topo.
// Usa o Chromium do Playwright (ja e dependencia de teste). Rode quando mudar a marca:
//   node scripts/generate-icons.mjs
// Saida: public/icons/*.png e public/favicon.svg (versionados no repositorio).
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'icons');
mkdirSync(outDir, { recursive: true });

const BG = '#06110c';
const GOLD_TOP = '#f2c14e';
const GOLD_BOTTOM = '#c98f12';
const INK = '#1d1503';

/**
 * markRatio: tamanho do quadrado dourado em relacao ao icone.
 * Icone "maskable" (Android recorta em circulo/gota): a marca fica dentro da
 * zona segura central de 80%, por isso e menor.
 */
function iconSvg(size, markRatio, rounded) {
  const mark = size * markRatio;
  const offset = (size - mark) / 2;
  const radius = mark * 0.22;
  const outerRadius = rounded ? size * 0.22 : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${GOLD_TOP}"/>
      <stop offset="1" stop-color="${GOLD_BOTTOM}"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${outerRadius}" fill="${BG}"/>
  <rect x="${offset}" y="${offset}" width="${mark}" height="${mark}" rx="${radius}" fill="url(#g)"/>
  <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle"
        font-family="'Barlow Condensed', 'Arial Narrow', sans-serif" font-weight="700"
        font-size="${mark * 0.42}" letter-spacing="${mark * 0.015}" fill="${INK}">WDD</text>
</svg>`;
}

const targets = [
  { file: 'icon-192.png', size: 192, markRatio: 0.78, rounded: false },
  { file: 'icon-512.png', size: 512, markRatio: 0.78, rounded: false },
  { file: 'icon-maskable-512.png', size: 512, markRatio: 0.6, rounded: false },
  { file: 'apple-touch-icon.png', size: 180, markRatio: 0.78, rounded: false },
  { file: 'favicon-32.png', size: 32, markRatio: 1, rounded: true }
];

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  for (const target of targets) {
    await page.setViewportSize({ width: target.size, height: target.size });
    await page.setContent(`<!doctype html><html><head>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700&display=block">
      <style>html,body{margin:0;background:transparent}</style></head>
      <body>${iconSvg(target.size, target.markRatio, target.rounded)}</body></html>`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: join(outDir, target.file), omitBackground: true, clip: { x: 0, y: 0, width: target.size, height: target.size } });
    console.log(`public/icons/${target.file}`);
  }
} finally {
  await browser.close();
}

// Favicon vetorial (navegadores de desktop)
writeFileSync(join(root, 'public', 'favicon.svg'), iconSvg(64, 1, true));
console.log('public/favicon.svg');

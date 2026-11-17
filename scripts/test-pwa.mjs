// Confere o app instalavel (Fase 8) no BUILD de producao, com o Chromium do Playwright:
//   npx vite build && node scripts/test-pwa.mjs
// Sobe o "vite preview", e verifica manifesto, instalabilidade (criterio do Chrome),
// service worker no controle, abertura sem internet e que nada do Supabase vai para o cache.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { chromium } from '@playwright/test';

const require = createRequire(import.meta.url);
const { installMockSupabase } = require('../tests/e2e/support/mockSupabase.js');

const PORT = 4175;
const BASE = `http://127.0.0.1:${PORT}`;
const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok, detail });

const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' });

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(BASE);
      if (res.ok) return;
    } catch { /* ainda subindo */ }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('vite preview nao respondeu');
}

let browser;
try {
  await waitForServer();
  browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(BASE, { waitUntil: 'load' });

  const manifest = await (await fetch(`${BASE}/manifest.webmanifest`)).json();
  check('manifesto com nome, start_url e display standalone', manifest.name === 'Bolão WDD' && manifest.start_url === '/' && manifest.display === 'standalone');
  check('manifesto com icones 192, 512 e maskable', ['192x192', '512x512'].every((size) => manifest.icons.some((icon) => icon.sizes === size))
    && manifest.icons.some((icon) => icon.purpose === 'maskable'));
  for (const icon of manifest.icons) {
    const res = await fetch(`${BASE}${icon.src}`);
    check(`icone ${icon.src} publicado`, res.ok && res.headers.get('content-type')?.includes('image/png'));
  }

  const version = await (await fetch(`${BASE}/version.json`)).json();
  const sw = await (await fetch(`${BASE}/sw.js`)).text();
  check('version.json e sw.js com o mesmo build', typeof version.build === 'string' && sw.includes(`const BUILD_ID = '${version.build}'`) && !sw.includes('__BUILD_ID__'));

  // Service worker assume a pagina
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload({ waitUntil: 'load' });
  const controlled = await page.evaluate(() => Boolean(navigator.serviceWorker.controller));
  check('service worker controla a pagina', controlled);

  // Criterio de instalacao do Chrome
  const cdp = await context.newCDPSession(page);
  const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors');
  check('Chrome considera instalavel', installabilityErrors.length === 0, JSON.stringify(installabilityErrors));

  // Sem internet: a pagina abre da copia do service worker
  await context.setOffline(true);
  await page.reload({ waitUntil: 'load' });
  const offlineTitle = await page.title();
  const offlineRoot = await page.locator('#root').count();
  check('abre sem internet', offlineRoot === 1 && /Bolão WDD/.test(offlineTitle), offlineTitle);
  await context.setOffline(false);

  const cached = await page.evaluate(async () => {
    const urls = [];
    for (const key of await caches.keys()) {
      const cache = await caches.open(key);
      for (const request of await cache.keys()) urls.push(request.url);
    }
    return urls;
  });
  check('cache sem Supabase, runtime-config ou version.json',
    cached.length > 0 && !cached.some((url) => /supabase|runtime-config|version\.json/.test(url)), cached.join(', '));

  // Aviso de nova versao: participante logado (Supabase simulado) e um deploy novo publicado
  const updateContext = await browser.newContext({ serviceWorkers: 'block' });
  await installMockSupabase(updateContext, { loggedInAs: 'u1' });
  let published = version.build;
  await updateContext.route('**/version.json*', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ build: published }) }));
  const appPage = await updateContext.newPage();
  await appPage.goto(`${BASE}/#/jogos`, { waitUntil: 'load' });
  await appPage.getByRole('heading', { name: 'Rodada 3' }).waitFor();
  check('sem deploy novo: nenhum aviso', (await appPage.getByText('Nova versão do Bolão WDD disponível.').count()) === 0);

  published = 'deploy-novo';
  await appPage.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  const banner = appPage.getByText('Nova versão do Bolão WDD disponível.');
  await banner.waitFor({ timeout: 10000 });
  check('deploy novo: aviso aparece ao voltar para o app', await banner.isVisible());
  await Promise.all([appPage.waitForEvent('load'), appPage.getByRole('button', { name: 'Atualizar o app' }).click()]);
  check('botao Atualizar recarrega o app', true);
  await updateContext.close();
} catch (err) {
  check('execucao', false, String(err));
} finally {
  await browser?.close();
  server.kill();
}

let failed = 0;
for (const r of results) {
  if (!r.ok) failed++;
  console.log(`${r.ok ? 'OK    ' : 'FALHOU'} ${r.name}${r.ok ? '' : `  -> ${r.detail}`}`);
}
console.log(`\n${results.length - failed}/${results.length} OK`);
process.exit(failed ? 1 : 0);

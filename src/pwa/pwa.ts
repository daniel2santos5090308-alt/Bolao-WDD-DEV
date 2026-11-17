/**
 * App instalavel (Fase 8): registro do service worker, aviso de nova versao e
 * pedido de instalacao. Tudo aqui e opcional: sem suporte do navegador, o app
 * funciona como site comum.
 */

/** Identificador do build atual ('dev' no Vite de desenvolvimento). */
export const APP_BUILD: string = typeof __APP_BUILD__ === 'string' ? __APP_BUILD__ : 'dev';

export const UPDATE_CHECK_MS = 10 * 60 * 1000;

/** Ha versao nova publicada? (nunca no modo dev, nem sem resposta valida) */
export function isNewBuild(current: string, remote: string | null | undefined): boolean {
  return Boolean(remote) && current !== 'dev' && remote !== current;
}

/** Busca /version.json sem cache (arquivo de poucos bytes no Netlify, nao no Supabase). */
export async function fetchRemoteBuild(): Promise<string | null> {
  try {
    const response = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) return null;
    const body = await response.json();
    return typeof body?.build === 'string' ? body.build : null;
  } catch {
    return null;
  }
}

export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => console.warn('Service worker não registrado:', err));
  });
}

/* ---------- instalacao ---------- */

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

/** Chamado uma vez no inicio: o Chrome dispara o evento antes de qualquer tela montar. */
export function captureInstallPrompt(): void {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notify();
  });
}

export function subscribeInstallPrompt(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function canPromptInstall(): boolean {
  return deferredPrompt !== null;
}

/** true = instalou. */
export async function promptInstall(): Promise<boolean> {
  if (!deferredPrompt) return false;
  const event = deferredPrompt;
  deferredPrompt = null;
  await event.prompt();
  const choice = await event.userChoice;
  notify();
  return choice.outcome === 'accepted';
}

/** Aberto pelo icone (app instalado), e nao pelo navegador. */
export function isStandalone(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia?.('(display-mode: standalone)').matches === true;
}

/** iPhone/iPad: nao tem botao de instalar; o caminho e Compartilhar > Adicionar a Tela de Inicio. */
export function isIos(userAgent: string = navigator.userAgent, maxTouchPoints: number = navigator.maxTouchPoints || 0): boolean {
  return /iPhone|iPad|iPod/i.test(userAgent) || (/Macintosh/i.test(userAgent) && maxTouchPoints > 1);
}

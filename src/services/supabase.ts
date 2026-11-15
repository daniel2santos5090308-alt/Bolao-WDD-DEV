import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Cliente Supabase unico do app.
 *
 * URL e chave anon vem de window.BOLAO_RUNTIME_CONFIG (public/assets/js/runtime-config.js),
 * gerado no build/dev por scripts/write-runtime-config.js a partir de SUPABASE_URL e
 * SUPABASE_ANON_KEY. Assim o mesmo bundle serve DEV e PROD (muda so a variavel no Netlify).
 */

let client: SupabaseClient | null = null;
let initError: Error | null = null;

function readRuntimeConfig(): BolaoRuntimeConfig {
  return (typeof window !== 'undefined' && window.BOLAO_RUNTIME_CONFIG) || {};
}

export function getAppEnv(): string {
  return readRuntimeConfig().APP_ENV || 'local';
}

/** Cliente ja inicializado, ou null se a configuracao estiver ausente. */
export function getSupabase(): SupabaseClient | null {
  if (client || initError) return client;

  const { SUPABASE_URL, SUPABASE_ANON_KEY } = readRuntimeConfig();
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    initError = new Error('Configuração do Supabase ausente (SUPABASE_URL / SUPABASE_ANON_KEY).');
    console.error(initError.message);
    return null;
  }

  client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return client;
}

/** Igual a getSupabase(), mas falha com mensagem clara. Use dentro de try/catch. */
export function requireSupabase(): SupabaseClient {
  const current = getSupabase();
  if (!current) throw initError || new Error('Supabase não inicializado.');
  return current;
}

/** Somente para testes: injeta um cliente falso (ou null para voltar ao normal). */
export function setSupabaseClientForTests(fake: unknown): void {
  client = fake as SupabaseClient | null;
  initError = null;
}

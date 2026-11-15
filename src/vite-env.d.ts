/// <reference types="vite/client" />

interface BolaoRuntimeConfig {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  APP_ENV?: string;
}

interface Window {
  /** Gerado por scripts/write-runtime-config.js e carregado antes do bundle. */
  BOLAO_RUNTIME_CONFIG?: BolaoRuntimeConfig;
}

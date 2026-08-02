/**
 * Configuração do Supabase.
 *
 * Em producao/DEV no Netlify, os valores vem de runtime-config.js,
 * gerado a partir das variaveis SUPABASE_URL e SUPABASE_ANON_KEY.
 */
const runtimeConfig = window.BOLAO_RUNTIME_CONFIG || {};
const SUPABASE_URL = runtimeConfig.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = runtimeConfig.SUPABASE_ANON_KEY || '';
const APP_ENV = runtimeConfig.APP_ENV || 'local';

let supabaseClient;

try {
    if (!window.supabase) {
        throw new Error('SDK do Supabase não carregado.');
    }

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        throw new Error('SUPABASE_URL e SUPABASE_ANON_KEY não configurados.');
    }

    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log(`Supabase inicializado com sucesso (${APP_ENV}).`);
} catch (error) {
    console.error('Erro ao inicializar Supabase.', error);
    alert('Erro: configuração do Supabase não encontrada ou inválida. Verifique o console.');
}


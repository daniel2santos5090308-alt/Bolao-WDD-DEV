/**
 * Configuração do Supabase.
 *
 * Preencha SUPABASE_URL e SUPABASE_ANON_KEY com os valores do projeto:
 * Supabase > Project Settings > API.
 */
const SUPABASE_URL = 'https://iwsmofannnpgeikgwxio.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3c21vZmFubm5wZ2Vpa2d3eGlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMxMTU0NTgsImV4cCI6MjA5ODY5MTQ1OH0.kgNcr9MNSYPZ85wi12YEa-IOZ_SwWNLxbu60fNM0eo4';

let supabaseClient;

try {
    if (!window.supabase) {
        throw new Error('SDK do Supabase não carregado.');
    }

    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('Supabase inicializado com sucesso!');
} catch (error) {
    console.error('Erro ao inicializar Supabase.', error);
    alert('Erro: configuração do Supabase não encontrada ou inválida. Verifique o console.');
}


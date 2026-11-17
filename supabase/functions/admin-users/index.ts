// Bolao WDD - Fase 7: Edge Function "admin-users".
//
// So o admin chama. Acoes (POST, corpo JSON):
//   { action: 'create', username, name, password }  -> cria login + perfil
//   { action: 'reset_password', userId, password }  -> nova senha do participante
//   { action: 'set_active', userId, active }        -> bloqueia/libera o login
//
// A chave de servico (SUPABASE_SERVICE_ROLE_KEY) e injetada pelo proprio
// Supabase nas Edge Functions: nao fica no navegador nem no repositorio.
// Arquivo unico de proposito: pode ser publicado pelo editor do painel.

import { createClient } from 'npm:@supabase/supabase-js@2.118.0';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,29}$/;
const MIN_PASSWORD = 6;
const BAN_FOREVER = '876000h';

function reply(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
  });
}

function fail(status: number, error: string): Response {
  return reply(status, { error });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return fail(405, 'Método não permitido.');

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceKey) return fail(500, 'Função sem a configuração do Supabase.');

  // Quem chama: valida a sessao com o token do proprio usuario.
  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: callerData, error: callerError } = await caller.auth.getUser();
  if (callerError || !callerData.user) return fail(401, 'Sessão expirada. Entre de novo.');

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: callerProfile } = await admin.from('profiles').select('role').eq('id', callerData.user.id).maybeSingle();
  if (callerProfile?.role !== 'admin') return fail(403, 'Apenas administradores podem gerenciar participantes.');

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail(400, 'Pedido inválido.');
  }

  const action = String(body.action ?? '');

  if (action === 'create') {
    const username = String(body.username ?? '').trim().toLowerCase();
    const name = String(body.name ?? '').trim();
    const password = String(body.password ?? '');
    if (!USERNAME_PATTERN.test(username)) {
      return fail(400, 'Usuário inválido: 3 a 30 caracteres, só letras minúsculas, números, ponto, hífen ou sublinhado.');
    }
    if (!name) return fail(400, 'Informe o nome do participante.');
    if (password.length < MIN_PASSWORD) return fail(400, `A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`);

    const { data: existing } = await admin.from('profiles').select('id').eq('username', username).maybeSingle();
    if (existing) return fail(409, `O usuário ${username} já existe.`);

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: `${username}@bolao.local`,
      password,
      email_confirm: true,
      user_metadata: { username, name }
    });
    if (createError || !created.user) return fail(400, `Não foi possível criar o login: ${createError?.message ?? 'erro desconhecido'}.`);

    const profile = { id: created.user.id, username, name, role: 'user', legacy_id: username, active: true };
    const { error: profileError } = await admin.from('profiles').insert(profile);
    if (profileError) {
      // Sem perfil o login nao serve para nada: desfaz.
      await admin.auth.admin.deleteUser(created.user.id);
      return fail(500, `Não foi possível criar o perfil: ${profileError.message}.`);
    }
    return reply(200, { user: profile });
  }

  // Demais acoes: so sobre participantes (nunca sobre admins nem sobre si mesmo).
  const userId = String(body.userId ?? '');
  const { data: target } = await admin.from('profiles').select('id, username, name, role').eq('id', userId).maybeSingle();
  if (!target) return fail(404, 'Participante não encontrado.');
  if (target.role === 'admin' || target.id === callerData.user.id) {
    return fail(403, 'Esta ação vale só para participantes.');
  }

  if (action === 'reset_password') {
    const password = String(body.password ?? '');
    if (password.length < MIN_PASSWORD) return fail(400, `A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`);
    const { error } = await admin.auth.admin.updateUserById(target.id, { password });
    if (error) return fail(400, `Não foi possível trocar a senha: ${error.message}.`);
    return reply(200, { ok: true });
  }

  if (action === 'set_active') {
    const active = body.active === true;
    const { error: banError } = await admin.auth.admin.updateUserById(target.id, { ban_duration: active ? 'none' : BAN_FOREVER });
    if (banError) return fail(400, `Não foi possível ${active ? 'reativar' : 'desativar'} o login: ${banError.message}.`);
    const { error: profileError } = await admin.from('profiles').update({ active }).eq('id', target.id);
    if (profileError) return fail(500, `Login ${active ? 'reativado' : 'bloqueado'}, mas o perfil não foi atualizado: ${profileError.message}.`);
    return reply(200, { ok: true, active });
  }

  return fail(400, 'Ação desconhecida.');
});

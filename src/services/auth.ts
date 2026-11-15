/** Login, logout e troca de senha (Supabase Auth + perfil em public.profiles). */
import { getSupabase, requireSupabase } from './supabase.ts';
import { clearCurrentUser, getCurrentUser, setCurrentUser } from './session.ts';
import { toUser } from './mappers.ts';
import { clearDataCache } from './storage.ts';
import { getLoginEmail } from './utils.ts';

export { getCurrentUser };

/** Entra com usuario (ou e-mail) e senha. Retorna o perfil, ou null se recusado. */
export async function login(username: string, password: string): Promise<BolaoUser | null> {
  const client = requireSupabase();
  const { data, error } = await client.auth.signInWithPassword({ email: getLoginEmail(username), password });
  if (error || !data.user) {
    if (error) console.error('Erro no login:', error);
    return null;
  }

  const { data: profile, error: profileError } = await client.from('profiles').select('*').eq('id', data.user.id).single();
  if (profileError || !profile) {
    console.error('Perfil não encontrado para o usuário autenticado:', profileError);
    await client.auth.signOut();
    return null;
  }

  // Outro usuario no mesmo navegador: nao reaproveita o cache do anterior
  clearDataCache();
  const user = toUser(profile);
  setCurrentUser(user);
  return user;
}

export async function logout(): Promise<void> {
  clearCurrentUser();
  clearDataCache();
  const client = getSupabase();
  if (client) await client.auth.signOut();
}

export async function hasSupabaseAuthSession(): Promise<boolean> {
  const client = getSupabase();
  if (!client) return false;

  const { data, error } = await client.auth.getSession();
  if (error) {
    console.warn('Não foi possível validar a sessão Supabase.', error);
    return false;
  }
  return Boolean(data.session);
}

/** Confere a senha atual antes de trocar. */
export async function updatePasswordWithCurrent(currentPassword: string, newPassword: string): Promise<boolean> {
  const currentUser = getCurrentUser();
  if (!currentUser) return false;
  const client = requireSupabase();

  const { error: signInError } = await client.auth.signInWithPassword({
    email: getLoginEmail(currentUser.username || ''),
    password: currentPassword
  });
  if (signInError) {
    console.error('Senha atual inválida:', signInError);
    return false;
  }

  const { error } = await client.auth.updateUser({ password: newPassword });
  if (error) console.error('Erro ao mudar senha:', error);
  return !error;
}

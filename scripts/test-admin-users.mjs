// Teste de ponta a ponta da Edge Function admin-users contra o Supabase LOCAL (Docker).
// NUNCA aponte para DEV/PROD: cria e altera usuarios de verdade.
// Uso (ver supabase/README.md):
//   npx supabase@3.2.0 start -x studio,imgproxy,inbucket,mailpit,realtime,storage-api,logflare,vector,supavisor,postgres-meta
//   eval "$(npx supabase@3.2.0 status -o env)" && API_URL=$API_URL ANON_KEY=$ANON_KEY SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY node scripts/test-admin-users.mjs
const API = process.env.API_URL || 'http://127.0.0.1:54321';
const ANON = process.env.ANON_KEY;
const SERVICE = process.env.SERVICE_ROLE_KEY;

if (!ANON || !SERVICE || !/^http:\/\/(127\.0\.0\.1|localhost)/.test(API)) {
  console.error('Rode so contra o Supabase local: defina API_URL (127.0.0.1), ANON_KEY e SERVICE_ROLE_KEY de "supabase status -o env".');
  process.exit(2);
}

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
}

async function call(path, { method = 'POST', key = ANON, token, body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${token || key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  let data = null;
  try { data = await res.json(); } catch { /* vazio */ }
  return { status: res.status, data };
}

async function login(username, password) {
  return call('/auth/v1/token?grant_type=password', { body: { email: `${username}@bolao.local`, password } });
}

// 1. Admin de teste
const adminUser = await call('/auth/v1/admin/users', { key: SERVICE, body: { email: 'admin@bolao.local', password: 'admin123', email_confirm: true } });
const adminId = adminUser.data?.id;
await call('/rest/v1/profiles', { key: SERVICE, body: { id: adminId, username: 'admin', name: 'Admin', role: 'admin' } });
const adminToken = (await login('admin', 'admin123')).data?.access_token;
check('admin entra', Boolean(adminToken), adminUser.status);

const fn = (body, token = adminToken) => call('/functions/v1/admin-users', { token, body });

// 2. Cria participante
const created = await fn({ action: 'create', username: 'diego.souza', name: 'Diego Souza', password: 'prov1234' });
check('cria participante (200)', created.status === 200, JSON.stringify(created.data));
const diegoId = created.data?.user?.id;

const profile = await call(`/rest/v1/profiles?id=eq.${diegoId}&select=username,name,role,active,legacy_id`, { method: 'GET', key: SERVICE });
check('perfil gravado como user ativo', profile.data?.[0]?.role === 'user' && profile.data?.[0]?.active === true && profile.data?.[0]?.legacy_id === 'diego.souza', JSON.stringify(profile.data));

const diegoLogin = await login('diego.souza', 'prov1234');
check('participante entra com a senha provisoria', Boolean(diegoLogin.data?.access_token), diegoLogin.status);

// 3. Duplicado e validacoes
const dup = await fn({ action: 'create', username: 'diego.souza', name: 'Outro', password: 'prov1234' });
check('usuario repetido recusado (409)', dup.status === 409, JSON.stringify(dup.data));
const badUser = await fn({ action: 'create', username: 'Diego Souza', name: 'X', password: 'prov1234' });
check('usuario invalido recusado (400)', badUser.status === 400, JSON.stringify(badUser.data));
const shortPass = await fn({ action: 'create', username: 'eva', name: 'Eva', password: '123' });
check('senha curta recusada (400)', shortPass.status === 400, JSON.stringify(shortPass.data));

// 4. Participante NAO usa a funcao
const notAdmin = await fn({ action: 'create', username: 'hacker', name: 'H', password: 'prov1234' }, diegoLogin.data?.access_token);
check('participante recusado (403)', notAdmin.status === 403, JSON.stringify(notAdmin.data));
const noToken = await call('/functions/v1/admin-users', { body: { action: 'create', username: 'x1x', name: 'x', password: 'prov1234' } });
check('sem login recusado (401)', noToken.status === 401, JSON.stringify(noToken.data));

// 5. Nova senha
const reset = await fn({ action: 'reset_password', userId: diegoId, password: 'nova5678' });
check('troca a senha (200)', reset.status === 200, JSON.stringify(reset.data));
check('senha antiga deixou de valer', !(await login('diego.souza', 'prov1234')).data?.access_token);
check('senha nova funciona', Boolean((await login('diego.souza', 'nova5678')).data?.access_token));

// 6. Admin nao pode ser alvo
const selfTarget = await fn({ action: 'set_active', userId: adminId, active: false });
check('admin nao desativa admin (403)', selfTarget.status === 403, JSON.stringify(selfTarget.data));

// 7. Desativar bloqueia login; reativar libera
const off = await fn({ action: 'set_active', userId: diegoId, active: false });
check('desativa (200)', off.status === 200, JSON.stringify(off.data));
const banned = await login('diego.souza', 'nova5678');
check('login bloqueado com user_banned', !banned.data?.access_token && (banned.data?.error_code === 'user_banned' || /banned/i.test(JSON.stringify(banned.data))), JSON.stringify(banned.data));
const offProfile = await call(`/rest/v1/profiles?id=eq.${diegoId}&select=active`, { method: 'GET', key: SERVICE });
check('perfil marcado inativo', offProfile.data?.[0]?.active === false, JSON.stringify(offProfile.data));
const on = await fn({ action: 'set_active', userId: diegoId, active: true });
check('reativa (200)', on.status === 200, JSON.stringify(on.data));
check('login volta a funcionar', Boolean((await login('diego.souza', 'nova5678')).data?.access_token));

let failed = 0;
for (const r of results) {
  if (!r.ok) failed++;
  console.log(`${r.ok ? 'OK    ' : 'FALHOU'} ${r.name}${r.ok ? '' : `  -> ${r.detail}`}`);
}
console.log(`\n${results.length - failed}/${results.length} OK`);
process.exit(failed ? 1 : 0);

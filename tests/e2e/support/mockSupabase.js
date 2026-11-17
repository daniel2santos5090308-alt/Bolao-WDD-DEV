/**
 * Supabase simulado para os testes E2E.
 *
 * Intercepta runtime-config.js (aponta o app para um projeto falso) e todas as
 * chamadas REST/Auth desse projeto, respondendo com dados ficticios. Nenhuma
 * requisicao chega ao Supabase real e nao precisa de senha.
 */

const SUPABASE_URL = 'http://e2e-mock.supabase.co';
const AUTH_STORAGE_KEY = 'sb-e2e-mock-auth-token';
const PASSWORD = 'senha-certa';

const users = [
  { id: 'admin', legacy_id: 'admin', username: 'admin', name: 'Admin', role: 'admin' },
  { id: 'u1', legacy_id: 'u1', username: 'ana', name: 'Ana', role: 'user' },
  { id: 'u2', legacy_id: 'u2', username: 'bruno', name: 'Bruno', role: 'user' },
  { id: 'u3', legacy_id: 'u3', username: 'carla', name: 'Carla', role: 'user' }
];

const TEAMS = ['Flamengo', 'Palmeiras', 'Corinthians', 'São Paulo', 'Grêmio', 'Internacional', 'Atlético-MG', 'Cruzeiro', 'Botafogo', 'Fluminense', 'Vasco', 'Santos'];

/** Data em Brasilia (YYYY-MM-DD) deslocada em dias a partir de hoje. */
function brasiliaDate(offsetDays) {
  const date = new Date(Date.now() - 3 * 3600e3 + offsetDays * 86400e3);
  return date.toISOString().slice(0, 10);
}

/**
 * Rodadas 1 e 2 encerradas; rodada 3 = atual, com jogos daqui a 2 dias (abertos);
 * rodada 4 = futura.
 */
function buildMatches() {
  const offsets = { r1: -14, r2: -7, r3: 2, r4: 9 };
  const matches = [];
  Object.entries(offsets).forEach(([roundId, offset], roundIndex) => {
    for (let k = 0; k < 6; k++) {
      const finished = roundIndex < 2;
      matches.push({
        id: `${roundId}m${k}`,
        round_id: roundId,
        match_date: brasiliaDate(offset),
        match_time: ['16:00:00', '18:30:00', '21:00:00'][k % 3],
        home_team: TEAMS[(k * 2 + roundIndex) % TEAMS.length],
        away_team: TEAMS[(k * 2 + 1 + roundIndex) % TEAMS.length],
        odd_home: 1, odd_draw: 1, odd_away: 1,
        is_bonus: k === 0,
        result: finished ? 'home' : null,
        score_home: finished ? 2 : null,
        score_away: finished ? 1 : null
      });
    }
  });
  return matches;
}

function createState() {
  return {
    matches: buildMatches(),
    rounds: ['r1', 'r2', 'r3', 'r4'].map((id, index) => ({ id, name: `Rodada ${index + 1}`, number: index + 1, season_key: '2027' })),
    savedBets: [],
    calls: [],
    users: users.map((user) => ({ ...user, active: true })),
    passwordResets: [],
    seasons: [
      { key: '2026', name: 'Brasileirão 2026', starts_on: null, ends_on: '2026-12-06', is_active: false },
      { key: '2027', name: 'Brasileirão 2027', starts_on: '2027-01-27', ends_on: null, is_active: true }
    ]
  };
}

function snapshotFor(state, userId) {
  const active = state.seasons.find((season) => season.is_active);
  return {
    version: 1,
    season: active ? { key: active.key, name: active.name } : null,
    profiles: state.users,
    rounds: state.rounds,
    matches: state.matches,
    standings: TEAMS.map((team, index) => ({
      id: `s${index}`, position: index + 1, team, points: 30 - index * 2, played: 12, wins: 9 - Math.floor(index / 2),
      draws: index % 3, losses: index % 4, goals_for: 20 - index, goals_against: 8 + index, goal_diff: 12 - index * 2, season_key: '2027'
    })),
    scoring_settings: { id: 'default', exact_score_points: 10, near_miss_points: 7, wrong_points: 0, bonus_multiplier: 2, bonus_enabled: true },
    my_bets: state.savedBets.filter((bet) => bet.user_id === userId)
  };
}

const ranking = [
  { position: 1, user_id: 'u2', user_name: 'Bruno', points: 96, exact_hits: 4, near_misses: 8, bonus_hits: 1, bets_count: 12 },
  { position: 2, user_id: 'u1', user_name: 'Ana', points: 89, exact_hits: 3, near_misses: 9, bonus_hits: 1, bets_count: 12 },
  { position: 3, user_id: 'u3', user_name: 'Carla', points: 70, exact_hits: 2, near_misses: 8, bonus_hits: 0, bets_count: 11 }
];

const storeItems = [
  { id: 'i1', code: 'badge_cravador', name: 'Selo Cravador', description: 'Selo para o perfil.', item_type: 'profile_badge', price: 200, rarity: 'raro', preview_value: '/assets/store/cravador_de_placar_512.png', is_active: true, sort_order: 1 },
  { id: 'i2', code: 'card_bonus_glow', name: 'Card Bônus Iluminado', description: 'Visual para o jogo bônus.', item_type: 'match_card_skin', price: 350, rarity: 'epico', preview_value: '#f59e0b', is_active: true, sort_order: 2 }
];

const coinTransactions = [
  { id: 't1', user_id: 'u1', transaction_type: 'initial_balance', amount: 100, description: 'Saldo inicial da temporada', created_at: '2027-01-20T12:00:00Z', available_balance_after: 100, locked_balance_after: 0 },
  { id: 't2', user_id: 'u1', transaction_type: 'round_reward', amount: 30, description: 'Rodada 1 - 2º lugar', created_at: '2027-02-01T12:00:00Z', available_balance_after: 130, locked_balance_after: 0 }
];

function fakeSession(user) {
  const exp = Math.floor(Date.now() / 1000) + 86400;
  const payload = Buffer.from(JSON.stringify({ sub: user.id, exp, role: 'authenticated' })).toString('base64url');
  return {
    access_token: `e2e.${payload}.mock`,
    token_type: 'bearer',
    expires_in: 86400,
    expires_at: exp,
    refresh_token: 'e2e-refresh',
    user: { id: user.id, aud: 'authenticated', role: 'authenticated', email: `${user.username}@bolao.local` }
  };
}

function applyEqFilters(rows, searchParams) {
  let result = rows;
  for (const [key, value] of searchParams) {
    if (!value.startsWith('eq.') || !result.length || !(key in result[0])) continue;
    result = result.filter((row) => String(row[key]) === value.slice(3));
  }
  return result;
}

/**
 * Instala o Supabase simulado no contexto do Playwright.
 * @param {import('@playwright/test').BrowserContext} context
 * @param {{ loggedInAs?: string }} [options] id do usuario ja logado (pula a tela de login)
 */
async function installMockSupabase(context, options = {}) {
  const state = createState();
  let currentUserId = options.loggedInAs || null;

  if (options.loggedInAs) {
    const user = users.find((entry) => entry.id === options.loggedInAs);
    await context.addInitScript(([profile, session, storageKey]) => {
      localStorage.setItem('bolao_wdd_session', JSON.stringify({ id: profile.id, legacyId: profile.legacy_id, username: profile.username, name: profile.name, role: profile.role }));
      localStorage.setItem(storageKey, JSON.stringify(session));
    }, [user, fakeSession(user), AUTH_STORAGE_KEY]);
  }

  await context.route('**/assets/js/runtime-config.js', (route) => route.fulfill({
    contentType: 'application/javascript',
    body: `window.BOLAO_RUNTIME_CONFIG = { SUPABASE_URL: '${SUPABASE_URL}', SUPABASE_ANON_KEY: 'e2e-anon', APP_ENV: 'e2e' };`
  }));

  // Escudos externos: o app mostra as iniciais quando a imagem falha.
  await context.route(/^https:\/\/(ssl\.gstatic\.com|upload\.wikimedia\.org|cdn\.prod\.website-files\.com)\//, (route) => route.abort());

  await context.route(`${SUPABASE_URL}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    const wantsObject = (request.headers().accept || '').includes('vnd.pgrst.object');
    const body = request.postData() ? JSON.parse(request.postData()) : null;
    const json = (data, status = 200) => route.fulfill({
      status,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*', 'content-range': '0-0/*' },
      body: JSON.stringify(data)
    });

    if (method === 'OPTIONS') {
      return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    }
    state.calls.push(`${method} ${path}`);

    if (path === '/auth/v1/token') {
      const user = state.users.find((entry) => `${entry.username}@bolao.local` === body?.email);
      if (user && user.active === false) {
        return json({ code: 400, error_code: 'user_banned', msg: 'User is banned' }, 400);
      }
      if (!user || body?.password !== PASSWORD) {
        return json({ error: 'invalid_grant', error_description: 'Invalid login credentials' }, 400);
      }
      currentUserId = user.id;
      return json(fakeSession(user));
    }
    if (path.startsWith('/auth/v1/')) return json({});

    // Edge Function admin-users (Fase 7)
    if (path === '/functions/v1/admin-users') {
      if (body?.action === 'create') {
        if (state.users.some((user) => user.username === body.username)) return json({ error: `O usuário ${body.username} já existe.` }, 409);
        const created = { id: `new-${body.username}`, legacy_id: body.username, username: body.username, name: body.name, role: 'user', active: true };
        state.users.push(created);
        return json({ user: created });
      }
      const target = state.users.find((user) => user.id === body?.userId);
      if (!target) return json({ error: 'Participante não encontrado.' }, 404);
      if (body.action === 'reset_password') {
        state.passwordResets.push({ userId: target.id, password: body.password });
        return json({ ok: true });
      }
      if (body.action === 'set_active') {
        target.active = body.active === true;
        return json({ ok: true, active: target.active });
      }
      return json({ error: 'Ação desconhecida.' }, 400);
    }
    if (path === '/rest/v1/rpc/initialize_coin_wallets_for_season') return json([]);

    if (path === '/rest/v1/rpc/get_app_snapshot') return json(snapshotFor(state, currentUserId));
    if (path === '/rest/v1/rpc/get_ranking') return json(ranking);
    if (path === '/rest/v1/rpc/get_ranking_history') return json([]);
    if (path === '/rest/v1/rpc/create_season') {
      if (state.seasons.some((season) => season.key === body.p_key)) {
        return json({ code: 'P0001', message: `A temporada ${body.p_key} já existe` }, 400);
      }
      const created = { key: body.p_key, name: body.p_name || `Brasileirão ${body.p_key}`, starts_on: body.p_starts_on, ends_on: null, is_active: false };
      state.seasons.push(created);
      return json(created);
    }
    if (path === '/rest/v1/rpc/activate_season') {
      const target = state.seasons.find((season) => season.key === body.p_key);
      if (!target) return json({ code: 'P0001', message: 'Temporada não encontrada' }, 400);
      state.seasons.forEach((season) => {
        if (season.is_active && season !== target) season.ends_on = season.ends_on || '2027-12-08';
        season.is_active = season === target;
      });
      target.ends_on = null;
      return json(target);
    }
    if (path === '/rest/v1/rpc/get_season_bets') return json(state.savedBets.filter((bet) => !body?.p_user_id || bet.user_id === body.p_user_id));

    const table = path.replace('/rest/v1/', '');
    if (table === 'bets' && method === 'POST') {
      const rows = Array.isArray(body) ? body : [body];
      rows.forEach((row) => {
        state.savedBets = state.savedBets.filter((bet) => !(bet.user_id === row.user_id && bet.match_id === row.match_id));
        state.savedBets.push(row);
      });
      return json(null, 201);
    }
    // Admin: importacao/cadastro de rodadas e jogos (upsert por id)
    if ((table === 'rounds' || table === 'matches') && method === 'POST') {
      const list = table === 'rounds' ? state.rounds : state.matches;
      (Array.isArray(body) ? body : [body]).forEach((row) => {
        const saved = table === 'rounds' ? { season_key: '2027', ...row } : row;
        const index = list.findIndex((item) => item.id === saved.id);
        if (index >= 0) list[index] = { ...list[index], ...saved };
        else list.push(saved);
      });
      return json(null, 201);
    }
    if (method !== 'GET') return json(null, 201);

    const tables = {
      app_meta: [{ id: 1, version: 1 }],
      seasons: state.seasons,
      profiles: state.users,
      coin_wallet_summary: state.users.filter((user) => user.role !== 'admin').map((user) => ({
        id: `w-${user.id}`, user_id: user.id, user_name: user.name, season_key: '2027', available_balance: 130, locked_balance: 0, total_balance: 130
      })),
      coin_settings: [{ season_key: '2027', initial_balance: 100, first_place_reward: 50, second_place_reward: 30, third_place_reward: 15, exact_score_reward: 5, bonus_exact_score_reward: 10, full_round_participation_reward: 5 }],
      coin_transactions: coinTransactions,
      coin_store_items: storeItems,
      coin_user_items: [],
      coin_round_processes: []
    };
    if (!(table in tables)) return json([]);

    const rows = applyEqFilters(tables[table], url.searchParams);
    return json(wantsObject ? rows[0] || null : rows);
  });

  return state;
}

module.exports = { installMockSupabase, PASSWORD, users, brasiliaDate };

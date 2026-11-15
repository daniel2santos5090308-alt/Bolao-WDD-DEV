import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

/* ---------- ambiente de navegador minimo ---------- */

class MemoryStorage {
  data = new Map<string, string>();
  getItem(key: string) { return this.data.has(key) ? this.data.get(key)! : null; }
  setItem(key: string, value: string) { this.data.set(key, String(value)); }
  removeItem(key: string) { this.data.delete(key); }
  clear() { this.data.clear(); }
}

const localStorageMock = new MemoryStorage();
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, configurable: true });

const { isMatchStarted, getLoginEmail } = await import('../src/services/utils.ts');
const { calculateMatchPoints, formatPoints, getScoringSettings } = await import('../src/services/scoring.ts');
const { getCanonicalTeamName, getTeamInitials, getTeamLogoUrl } = await import('../src/services/teams.ts');
const mappers = await import('../src/services/mappers.ts');
const storage = await import('../src/services/storage.ts');
const { logout } = await import('../src/services/auth.ts');
const { setSupabaseClientForTests } = await import('../src/services/supabase.ts');
const { SESSION_KEY } = await import('../src/services/session.ts');

const rootDir = path.resolve(import.meta.dirname, '..');

/* ---------- utils ---------- */

test('isMatchStarted usa o horario de Brasilia (-03:00), independente do fuso do aparelho', () => {
  // 19:00 em Brasilia = 22:00 UTC
  assert.equal(isMatchStarted('2027-01-27', '19:00', new Date('2027-01-27T21:59:00Z')), false);
  assert.equal(isMatchStarted('2027-01-27', '19:00', new Date('2027-01-27T22:00:00Z')), true);
  // Aceita "HH:MM:SS" vindo do banco
  assert.equal(isMatchStarted('2027-01-27', '19:00:00', new Date('2027-01-27T22:00:01Z')), true);
});

test('getLoginEmail mantem e-mails e mapeia usuarios para @bolao.local', () => {
  assert.equal(getLoginEmail('daniel'), 'daniel@bolao.local');
  assert.equal(getLoginEmail(' Daniel '), 'daniel@bolao.local');
  assert.equal(getLoginEmail('admin@bolao.local'), 'admin@bolao.local');
});

/* ---------- pontuacao de um palpite ---------- */

const settings = getScoringSettings({
  scoringSettings: { exactScorePoints: 10, nearMissPoints: 7, wrongPoints: 0, bonusMultiplier: 2, bonusEnabled: true }
});

function finishedMatch(home: number, away: number, isBonus = false): BolaoMatch {
  return {
    id: 'm1', roundId: 'r1', date: '2027-01-27', time: '19:00', homeTeam: 'A', awayTeam: 'B',
    isBonus, result: home > away ? 'home' : home < away ? 'away' : 'draw', score: { home, away }
  };
}

test('calculateMatchPoints: placar exato, na trave, erro e bonus x2', () => {
  const exact = calculateMatchPoints(finishedMatch(2, 1), { scoreHome: 2, scoreAway: 1 }, settings);
  assert.equal(exact.points, 10);
  assert.equal(exact.label, 'Placar exato');
  assert.equal(exact.isExact, true);

  const near = calculateMatchPoints(finishedMatch(2, 1), { scoreHome: 1, scoreAway: 0 }, settings);
  assert.equal(near.points, 7);
  assert.equal(near.label, 'Na trave');
  assert.equal(near.isNearMiss, true);

  const wrong = calculateMatchPoints(finishedMatch(2, 1), { scoreHome: 1, scoreAway: 1 }, settings);
  assert.equal(wrong.points, 0);
  assert.equal(wrong.isHit, false);

  const bonus = calculateMatchPoints(finishedMatch(1, 1, true), { scoreHome: 1, scoreAway: 1 }, settings);
  assert.equal(bonus.points, 20);
  assert.equal(bonus.multiplier, 2);
});

test('calculateMatchPoints: jogo sem placar ou palpite oculto fica "Aguardando"', () => {
  const pending = { ...finishedMatch(0, 0), result: null, score: null };
  assert.equal(calculateMatchPoints(pending, { scoreHome: 1, scoreAway: 0 }, settings).label, 'Aguardando');

  // Palpite de outro participante ainda oculto pelo banco (sem placar)
  const hidden = calculateMatchPoints(finishedMatch(1, 0), { scoreHome: null, scoreAway: null }, settings);
  assert.equal(hidden.points, 0);
  assert.equal(hidden.label, 'Aguardando');
});

test('formatPoints omite zeros decimais desnecessarios', () => {
  assert.equal(formatPoints(50), '50');
  assert.equal(formatPoints(103.0), '103');
  assert.equal(formatPoints(10.5), '10,5');
  assert.equal(formatPoints(7.25), '7,25');
  assert.equal(formatPoints(Number.NaN), '0');
});

/* ---------- times ---------- */

test('teams: nomes canonicos, escudo e iniciais', () => {
  assert.equal(getCanonicalTeamName('Gremio'), 'Grêmio');
  assert.equal(getCanonicalTeamName('sao paulo'), 'São Paulo');
  assert.equal(getCanonicalTeamName('Red Bull Bragantino'), 'RB Bragantino');
  assert.ok(getTeamLogoUrl('Flamengo')?.startsWith('https://'));
  assert.equal(getTeamLogoUrl('Time Inexistente'), null);
  assert.equal(getTeamInitials('Time Inexistente'), 'TI');
  assert.equal(getTeamInitials('Bahia'), 'BA');
  assert.equal(getTeamInitials(''), '?');
});

/* ---------- mapeadores ---------- */

test('mappers convertem jogo do Supabase para o app e de volta', () => {
  const row = {
    id: 'm1', round_id: 'r1', match_date: '2026-07-04', match_time: '19:30:00',
    home_team: 'Flamengo', away_team: 'Palmeiras', odd_home: '1.75', odd_draw: '3.25', odd_away: '4.10',
    is_bonus: true, result: 'home', score_home: 2, score_away: 1
  };

  const match = mappers.toMatch(row);
  assert.deepEqual(match, {
    id: 'm1', roundId: 'r1', date: '2026-07-04', time: '19:30', homeTeam: 'Flamengo', awayTeam: 'Palmeiras',
    odds: { home: 1.75, draw: 3.25, away: 4.1 }, isBonus: true, result: 'home', score: { home: 2, away: 1 }
  });

  assert.deepEqual(mappers.fromMatch(match), {
    id: 'm1', round_id: 'r1', match_date: '2026-07-04', match_time: '19:30', home_team: 'Flamengo',
    away_team: 'Palmeiras', odd_home: 1.75, odd_draw: 3.25, odd_away: 4.1, is_bonus: true, result: 'home',
    score_home: 2, score_away: 1
  });

  assert.equal(mappers.toMatch({ ...row, score_home: null, score_away: null, result: null }).score, null);
});

test('mappers.toBet preserva palpite oculto como null (nao vira 0)', () => {
  assert.deepEqual(mappers.toBet({ pick: null, score_home: null, score_away: null, created_at: 'x' }), {
    pick: null, scoreHome: null, scoreAway: null, createdAt: 'x'
  });
});

/* ---------- camada de dados (Supabase falso) ---------- */

function createSupabaseMock(state: { version: number }) {
  const calls = { snapshot: 0, version: 0, ranking: 0, upsert: 0, signOut: 0 };

  const client = {
    auth: { signOut: async () => { calls.signOut += 1; return { error: null }; } },
    from(table: string) {
      const query: any = {
        select() { return query; },
        eq() { return query; },
        in() { return query; },
        order() { return query; },
        maybeSingle: async () => {
          if (table === 'app_meta') {
            calls.version += 1;
            return { data: { version: state.version }, error: null };
          }
          return { data: null, error: null };
        },
        upsert: async () => {
          calls.upsert += 1;
          return { error: null };
        },
        delete() { return query; },
        then(resolve: (value: unknown) => void) { resolve({ data: [], error: null }); }
      };
      return query;
    },
    rpc: async (name: string) => {
      if (name === 'get_app_snapshot') {
        calls.snapshot += 1;
        return {
          data: {
            version: state.version,
            season: { key: '2027', name: 'Brasileirão 2027' },
            profiles: [{ id: 'u1', legacy_id: 'u1', username: 'daniel', name: 'Daniel', role: 'user' }],
            rounds: [{ id: 'r1', name: 'Rodada 1', number: 1, season_key: '2027' }],
            matches: [],
            standings: [],
            scoring_settings: { id: 'default', exact_score_points: 10, near_miss_points: 7, wrong_points: 0, bonus_multiplier: 2, bonus_enabled: true },
            my_bets: [{ user_id: 'u1', match_id: 'm1', pick: 'home', score_home: 2, score_away: 1, created_at: '2027-01-27T10:00:00Z' }]
          },
          error: null
        };
      }
      if (name === 'get_ranking') {
        calls.ranking += 1;
        return {
          data: [{ position: 1, user_id: 'u1', user_name: 'Daniel', points: '10.00', exact_hits: 1, near_misses: 0, bonus_hits: 0, bets_count: 1 }],
          error: null
        };
      }
      return { data: null, error: { message: `rpc inesperada: ${name}` } };
    }
  };

  return { client, calls };
}

function resetAll() {
  localStorageMock.clear();
  storage.resetMemoryForTests();
  setSupabaseClientForTests(null);
}

test('getData baixa um snapshot, guarda em cache e so baixa de novo quando o carimbo muda', async () => {
  resetAll();
  const state = { version: 5 };
  const { client, calls } = createSupabaseMock(state);
  setSupabaseClientForTests(client);
  localStorageMock.setItem(SESSION_KEY, JSON.stringify({ id: 'u1', name: 'Daniel', role: 'user' }));

  // Cargas simultaneas = 1 chamada so
  const [firstLoad, secondLoad] = await Promise.all([storage.getData(), storage.getData()]);
  assert.equal(calls.snapshot, 1);
  assert.deepEqual(firstLoad, secondLoad);
  assert.equal(firstLoad.season?.key, '2027');
  assert.equal(firstLoad.bets.u1.m1.scoreHome, 2);

  // Retorna copia: mutacao externa nao afeta o cache
  firstLoad.rounds.push({ id: 'mutated', name: 'Mutated', number: 99 });
  assert.equal((await storage.getData()).rounds.length, 1);

  // Gravacao atualiza o cache local sem baixar tudo de novo
  await storage.addRound({ id: 'r2', name: 'Rodada Cache', number: 2 });
  assert.equal((await storage.getData()).rounds.length, 2);
  assert.equal(calls.snapshot, 1);
  assert.equal(calls.version, 0);

  // Passado o intervalo, consulta so o carimbo; mesma versao = sem novo snapshot
  storage.expireVersionCheckForTests();
  await storage.getData();
  assert.equal(calls.version, 1);
  assert.equal(calls.snapshot, 1);

  // Versao mudou no banco = baixa o snapshot de novo
  state.version = 6;
  storage.expireVersionCheckForTests();
  const refreshed = await storage.getData();
  assert.equal(calls.snapshot, 2);
  assert.equal(refreshed.version, 6);

  // Recarga da pagina: reaproveita o cache persistido (so confere o carimbo)
  storage.resetMemoryForTests();
  const second = createSupabaseMock(state);
  setSupabaseClientForTests(second.client);
  const restored = await storage.getData();
  assert.equal(restored.version, 6);
  assert.equal(second.calls.snapshot, 0);
  assert.equal(second.calls.version, 1);

  // Logout limpa sessao e cache persistido
  await logout();
  assert.equal(localStorageMock.getItem(storage.PERSIST_KEY), null);
  assert.equal(localStorageMock.getItem(SESSION_KEY), null);
  assert.equal(second.calls.signOut, 1);
});

test('cache persistido de outro usuario e ignorado', async () => {
  resetAll();
  const { client, calls } = createSupabaseMock({ version: 1 });
  setSupabaseClientForTests(client);
  localStorageMock.setItem(storage.PERSIST_KEY, JSON.stringify({ userId: 'outro', data: { version: 1, rounds: [] } }));
  localStorageMock.setItem(SESSION_KEY, JSON.stringify({ id: 'u1', name: 'Daniel', role: 'user' }));

  await storage.getData();
  assert.equal(calls.snapshot, 1);
});

test('getRanking mapeia o ranking do banco e guarda em cache por versao', async () => {
  resetAll();
  const { client, calls } = createSupabaseMock({ version: 1 });
  setSupabaseClientForTests(client);

  const ranking = await storage.getRanking(null);
  await storage.getRanking('all');
  assert.equal(calls.ranking, 1);
  assert.deepEqual(ranking[0], {
    id: 'u1', name: 'Daniel', position: 1, points: 10, exactHits: 1, nearMisses: 0, bonusHits: 0, betsCount: 1
  });

  await storage.getRanking('r1');
  assert.equal(calls.ranking, 2);
});

test('sem configuracao do Supabase, as chamadas falham com mensagem clara', async () => {
  resetAll();
  await assert.rejects(storage.getData(), /Supabase/);
});

/* ---------- paginas estaticas ---------- */

const htmlPages = ['index.html', 'react.html', 'public/login.html', 'public/admin.html', 'public/user.html', 'public/404.html'];

test('paginas HTML so referenciam arquivos locais que existem', () => {
  for (const page of htmlPages) {
    const html = fs.readFileSync(path.join(rootDir, page), 'utf8');
    const references = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((match) => match[1]);

    for (const reference of references) {
      if (/^(https?:|#|mailto:)/.test(reference)) continue;
      const localPath = reference.split('?')[0].replace(/^\//, '');
      const candidates = [path.join(rootDir, localPath), path.join(rootDir, 'public', localPath)];
      assert.ok(candidates.some((candidate) => fs.existsSync(candidate)), `${page} referencia arquivo inexistente: ${reference}`);
    }
  }
});

test('paginas HTML nao carregam o JS legado nem expoem cadastro publico', () => {
  for (const page of htmlPages) {
    const html = fs.readFileSync(path.join(rootDir, page), 'utf8').toLowerCase();
    assert.equal(/storage-supabase|supabase-init|ranking\.js|teams\.js|bolaolegacy/.test(html), false, `${page} ainda carrega JS legado`);
    assert.equal(html.includes('firebase'), false, `${page} nao deve referenciar Firebase`);
    assert.equal(html.includes('signup'), false, `${page} nao deve expor signup`);
    assert.equal(html.includes('register'), false, `${page} nao deve expor register`);
  }
});

/* ---------- rodada atual e rotulos de Coins ---------- */

test('getCurrentRoundId: primeira rodada (por numero) com jogo sem resultado; senao, a ultima', async () => {
  const { getCurrentRoundId } = await import('../src/services/matches.ts');
  const rounds = [{ id: 'r2', name: 'Rodada 2', number: 2 }, { id: 'r1', name: 'Rodada 1', number: 1 }, { id: 'r3', name: 'Rodada 3', number: 3 }];
  const match = (id: string, roundId: string, result: string | null): BolaoMatch => ({ id, roundId, date: '2027-01-27', time: '19:00', homeTeam: 'A', awayTeam: 'B', result });

  assert.equal(getCurrentRoundId(rounds, [match('a', 'r1', 'home'), match('b', 'r2', null), match('c', 'r3', null)]), 'r2');
  assert.equal(getCurrentRoundId(rounds, [match('a', 'r1', 'home'), match('b', 'r2', 'draw')]), 'r3');
  assert.equal(getCurrentRoundId([], []), '');
});

test('coinLabels traduz tipo e raridade gravados no banco', async () => {
  const { getItemTypeLabel, getRarityLabel } = await import('../src/services/coinLabels.ts');
  assert.equal(getItemTypeLabel('profile_badge'), 'Selo de perfil');
  assert.equal(getItemTypeLabel('desconhecido'), 'desconhecido');
  assert.equal(getRarityLabel('epico'), 'Épico');
  assert.equal(getRarityLabel('Lendario'), 'Lendário');
  assert.equal(getRarityLabel('raro'), 'Raro');
});

test('unsavedChanges: pergunta só com palpite pendente e zera ao confirmar', async () => {
  const { setUnsavedCount, getUnsavedCount, confirmDiscardUnsaved, unsavedMessage } = await import('../src/services/unsavedChanges.ts');
  const asked: string[] = [];

  setUnsavedCount(0);
  assert.equal(confirmDiscardUnsaved((message) => { asked.push(message); return false; }), true);
  assert.equal(asked.length, 0);

  setUnsavedCount(2);
  assert.equal(confirmDiscardUnsaved(() => false), false);
  assert.equal(getUnsavedCount(), 2);
  assert.equal(confirmDiscardUnsaved(() => true), true);
  assert.equal(getUnsavedCount(), 0);

  assert.match(unsavedMessage(1), /1 palpite não salvo\. .*esse palpite\?/);
  assert.match(unsavedMessage(3), /3 palpites não salvos\. .*esses palpites\?/);
});

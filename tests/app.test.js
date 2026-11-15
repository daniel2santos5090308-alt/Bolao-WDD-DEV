const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const rootDir = path.resolve(__dirname, '..');

function loadBrowserScript(relativePath, extraContext = {}) {
  const context = vm.createContext({
    console,
    window: {},
    localStorage: {
      data: new Map(),
      getItem(key) {
        return this.data.has(key) ? this.data.get(key) : null;
      },
      setItem(key, value) {
        this.data.set(key, String(value));
      },
      removeItem(key) {
        this.data.delete(key);
      }
    },
    document: {
      addEventListener() {},
      getElementById() {
        return null;
      }
    },
    alert() {},
    crypto: {
      subtle: {
        digest() {
          throw new Error('crypto.subtle.digest is not available in these tests');
        }
      }
    },
    ...extraContext
  });

  const source = fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
  vm.runInContext(`${source}\n;globalThis.__exports = { Utils: typeof Utils !== 'undefined' ? Utils : undefined, Ranking: typeof Ranking !== 'undefined' ? Ranking : undefined, Storage: typeof Storage !== 'undefined' ? Storage : undefined };`, context, {
    filename: relativePath
  });

  return context.__exports;
}

const { Utils } = loadBrowserScript('public/assets/js/utils.js');
const { Ranking } = loadBrowserScript('public/assets/js/ranking.js', { Utils });
const { Storage } = loadBrowserScript('public/assets/js/storage-supabase.js');

test('Utils.escapeHtml escapes unsafe markup', () => {
  assert.equal(
    Utils.escapeHtml(`<img src=x onerror="alert('x')">`),
    '&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;'
  );
});

test('Utils.isMatchLocked respects current date and match time', () => {
  const realDate = Date;
  const fixedNow = new realDate('2026-07-04T12:00:00');

  class FakeDate extends realDate {
    constructor(...args) {
      return args.length === 0 ? new realDate(fixedNow) : new realDate(...args);
    }

    static now() {
      return fixedNow.getTime();
    }
  }

  const { Utils: fakeDateUtils } = loadBrowserScript('public/assets/js/utils.js', { Date: FakeDate });

  assert.equal(fakeDateUtils.isMatchLocked('2026-07-04', '11:59'), true);
  assert.equal(fakeDateUtils.isMatchLocked('2026-07-04', '12:01'), false);
});

test('Ranking.calculate excludes admin and scores users by score prediction rules', () => {
  const data = {
    scoringSettings: {
      exactScorePoints: 10,
      nearMissPoints: 7,
      wrongPoints: 0,
      bonusMultiplier: 2,
      bonusEnabled: true
    },
    users: [
      { id: 'admin', name: 'Admin', role: 'admin' },
      { id: 'u1', name: 'Daniel', role: 'user' },
      { id: 'u2', name: 'Danilo', role: 'user' }
    ],
    matches: [
      {
        id: 'm1',
        homeTeam: 'A',
        awayTeam: 'B',
        result: 'home',
        score: { home: 2, away: 1 },
        isBonus: true
      },
      {
        id: 'm2',
        homeTeam: 'C',
        awayTeam: 'D',
        result: 'draw',
        score: { home: 1, away: 1 }
      }
    ],
    bets: {
      u1: { m1: { scoreHome: 2, scoreAway: 1 }, m2: { scoreHome: 2, scoreAway: 2 } },
      u2: { m1: { scoreHome: 1, scoreAway: 0 } }
    }
  };

  const ranking = Ranking.calculate(data);

  assert.deepEqual(ranking.map((user) => user.id), ['u1', 'u2']);
  assert.equal(ranking[0].points, 27);
  assert.equal(ranking[0].hits, 2);
  assert.equal(ranking[0].exactHits, 1);
  assert.equal(ranking[0].nearMisses, 1);
  assert.equal(ranking[0].bonusHits, 1);
  assert.equal(ranking[0].betsCount, 2);
  assert.equal(ranking[1].points, 14);
  assert.equal(ranking[1].hits, 1);
  assert.equal(ranking[1].bonusHits, 1);
});

test('Ranking.calculate applies tie-breakers after points', () => {
  const data = {
    users: [
      { id: 'u1', name: 'Bruno', role: 'user' },
      { id: 'u2', name: 'Ana', role: 'user' },
      { id: 'u3', name: 'Carlos', role: 'user' }
    ],
    matches: [
      { id: 'm1', homeTeam: 'A', awayTeam: 'B', result: 'home', score: { home: 2, away: 1 } },
      { id: 'm2', homeTeam: 'C', awayTeam: 'D', result: 'home', score: { home: 3, away: 1 } }
    ],
    scoringSettings: {
      exactScorePoints: 10,
      nearMissPoints: 5,
      wrongPoints: 0,
      bonusMultiplier: 2,
      bonusEnabled: true
    },
    bets: {
      u1: { m1: { scoreHome: 1, scoreAway: 0 } },
      u2: { m2: { scoreHome: 4, scoreAway: 2 } },
      u3: { m1: { scoreHome: 4, scoreAway: 0 } }
    }
  };

  const ranking = Ranking.calculate(data);

  assert.deepEqual(ranking.map((user) => user.id), ['u2', 'u1', 'u3']);
  assert.equal(ranking[0].nearMisses, 1);
  assert.equal(ranking[1].nearMisses, 1);
  assert.equal(ranking[2].nearMisses, 1);
  // Empate total: posicao compartilhada, nome so ordena a exibicao
  assert.deepEqual(ranking.map((user) => user.position), [1, 1, 1]);
});

test('Ranking.calculate uses bolao tie-break: exact hits, near misses, bets count, then shared position', () => {
  const users = [
    { id: 'A', name: 'Zeca', role: 'user' },
    { id: 'B', name: 'Bia', role: 'user' },
    { id: 'C', name: 'Ana', role: 'user' }
  ];
  const scoringSettings = { exactScorePoints: 10, nearMissPoints: 5, wrongPoints: 0, bonusMultiplier: 2, bonusEnabled: true };

  // Mesmo cenario de supabase/tests/fase1_check.sql (rodada 1)
  const round1 = Ranking.calculate({
    users,
    scoringSettings,
    matches: [
      { id: 'm1', result: 'home', score: { home: 2, away: 1 } },
      { id: 'm2', result: 'draw', score: { home: 0, away: 0 } },
      { id: 'm3', result: 'away', score: { home: 1, away: 3 } }
    ],
    bets: {
      A: { m1: { scoreHome: 2, scoreAway: 1 }, m2: { scoreHome: 0, scoreAway: 0 }, m3: { scoreHome: 0, scoreAway: 0 } },
      B: { m1: { scoreHome: 2, scoreAway: 1 }, m2: { scoreHome: 1, scoreAway: 1 }, m3: { scoreHome: 0, scoreAway: 2 } },
      C: { m1: { scoreHome: 2, scoreAway: 1 }, m2: { scoreHome: 0, scoreAway: 0 } }
    }
  });

  assert.deepEqual(round1.map((user) => `${user.id}=${user.position}`), ['A=1', 'C=2', 'B=3']);
  assert.deepEqual(round1.map((user) => user.points), [20, 20, 20]);

  // Rodada 2: A e B empatados em tudo -> ambos 1o, C 3o (nome nao desempata)
  const round2 = Ranking.calculate({
    users,
    scoringSettings,
    matches: [{ id: 'm4', result: 'home', score: { home: 1, away: 0 } }],
    bets: {
      A: { m4: { scoreHome: 1, scoreAway: 0 } },
      B: { m4: { scoreHome: 1, scoreAway: 0 } },
      C: { m4: { scoreHome: 0, scoreAway: 1 } }
    }
  });

  assert.deepEqual(round2.map((user) => `${user.id}=${user.position}`), ['B=1', 'A=1', 'C=3']);
});

test('Ranking.calculate counts masked bets without awarding hidden picks', () => {
  const data = {
    users: [{ id: 'u1', name: 'Daniel', role: 'user' }],
    matches: [
      {
        id: 'm1',
        homeTeam: 'A',
        awayTeam: 'B',
        result: 'home',
        score: { home: 2, away: 1 }
      }
    ],
    bets: {
      u1: { m1: { scoreHome: null, scoreAway: null } }
    }
  };

  const [user] = Ranking.calculate(data);

  assert.equal(user.betsCount, 1);
  assert.equal(user.points, 0);
  assert.equal(user.hits, 0);
  assert.equal(user.history.length, 1);
  assert.equal(user.history[0].betScore, null);
});

test('Ranking.calculateByRound filters matches by round', () => {
  const data = {
    users: [{ id: 'u1', name: 'Daniel', role: 'user' }],
    matches: [
      { id: 'm1', roundId: 'r1', homeTeam: 'A', awayTeam: 'B', result: 'home', score: { home: 2, away: 1 } },
      { id: 'm2', roundId: 'r2', homeTeam: 'C', awayTeam: 'D', result: 'away', score: { home: 0, away: 1 } }
    ],
    bets: {
      u1: { m1: { scoreHome: 2, scoreAway: 1 }, m2: { scoreHome: 0, scoreAway: 1 } }
    }
  };

  const [roundRanking] = Ranking.calculateByRound(data, 'r2');

  assert.equal(roundRanking.points, 10);
  assert.equal(roundRanking.betsCount, 1);
});

test('Ranking.formatPoints omits unnecessary decimal zeros', () => {
  assert.equal(Ranking.formatPoints(50), '50');
  assert.equal(Ranking.formatPoints(103.00), '103');
  assert.equal(Ranking.formatPoints(10.5), '10,5');
  assert.equal(Ranking.formatPoints(7.25), '7,25');
});

test('Storage.getLoginEmail keeps emails and maps usernames to bolao.local', () => {
  assert.equal(Storage.getLoginEmail('daniel'), 'daniel@bolao.local');
  assert.equal(Storage.getLoginEmail('Daniel'), 'daniel@bolao.local');
  assert.equal(Storage.getLoginEmail('admin@bolao.local'), 'admin@bolao.local');
});

test('Storage maps Supabase match rows to app match shape and back', () => {
  const row = {
    id: 'm1',
    round_id: 'r1',
    match_date: '2026-07-04',
    match_time: '19:30:00',
    home_team: 'Flamengo',
    away_team: 'Palmeiras',
    odd_home: '1.75',
    odd_draw: '3.25',
    odd_away: '4.10',
    is_bonus: true,
    result: 'home',
    score_home: 2,
    score_away: 1
  };

  const match = Storage.toMatch(row);

  assert.deepEqual(JSON.parse(JSON.stringify(match)), {
    id: 'm1',
    roundId: 'r1',
    date: '2026-07-04',
    time: '19:30',
    homeTeam: 'Flamengo',
    awayTeam: 'Palmeiras',
    odds: { home: 1.75, draw: 3.25, away: 4.1 },
    isBonus: true,
    result: 'home',
    score: { home: 2, away: 1 }
  });

  assert.deepEqual(JSON.parse(JSON.stringify(Storage.fromMatch(match))), {
    id: 'm1',
    round_id: 'r1',
    match_date: '2026-07-04',
    match_time: '19:30',
    home_team: 'Flamengo',
    away_team: 'Palmeiras',
    odd_home: 1.75,
    odd_draw: 3.25,
    odd_away: 4.1,
    is_bonus: true,
    result: 'home',
    score_home: 2,
    score_away: 1
  });
});

function createSupabaseMock(state) {
  const calls = { snapshot: 0, version: 0, ranking: 0, upsert: 0 };

  const client = {
    auth: { signOut: async () => ({ error: null }) },
    from(table) {
      const query = {
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
        then(resolve) { resolve({ data: [], error: null }); }
      };
      return query;
    },
    rpc: async (name) => {
      if (name === 'get_app_snapshot') {
        calls.snapshot += 1;
        return {
          data: {
            version: state.version,
            season: { key: '2027', name: 'Brasileirao 2027' },
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

function createLocalStorage() {
  return {
    data: new Map(),
    getItem(key) { return this.data.has(key) ? this.data.get(key) : null; },
    setItem(key, value) { this.data.set(key, String(value)); },
    removeItem(key) { this.data.delete(key); }
  };
}

test('Storage.getData loads one snapshot, caches it and only re-downloads when the version changes', async () => {
  const state = { version: 5 };
  const { client, calls } = createSupabaseMock(state);
  const sharedStorage = createLocalStorage();
  sharedStorage.setItem('bolao_wdd_session', JSON.stringify({ id: 'u1', name: 'Daniel', role: 'user' }));

  const { Storage: cachedStorage } = loadBrowserScript('public/assets/js/storage-supabase.js', {
    supabaseClient: client,
    localStorage: sharedStorage
  });

  // Cargas simultaneas = 1 chamada so
  const [firstLoad, secondLoad] = await Promise.all([cachedStorage.getData(), cachedStorage.getData()]);
  assert.equal(calls.snapshot, 1);
  assert.deepEqual(firstLoad, secondLoad);
  assert.equal(firstLoad.season.key, '2027');
  assert.equal(firstLoad.bets.u1.m1.scoreHome, 2);

  // Retorna copia: mutacao externa nao afeta o cache
  firstLoad.rounds.push({ id: 'mutated', name: 'Mutated', number: 99 });
  assert.equal((await cachedStorage.getData()).rounds.length, 1);

  // Gravacao atualiza o cache local sem baixar tudo de novo
  await cachedStorage.addRound({ id: 'r2', name: 'Rodada Cache', number: 2 });
  const updatedLoad = await cachedStorage.getData();
  assert.equal(updatedLoad.rounds.length, 2);
  assert.equal(calls.snapshot, 1);
  assert.equal(calls.version, 0);

  // Passado o intervalo, consulta so o carimbo; mesma versao = sem novo snapshot
  cachedStorage._lastVersionCheckAt = 0;
  await cachedStorage.getData();
  assert.equal(calls.version, 1);
  assert.equal(calls.snapshot, 1);

  // Versao mudou no banco = baixa o snapshot de novo
  state.version = 6;
  cachedStorage._lastVersionCheckAt = 0;
  const refreshed = await cachedStorage.getData();
  assert.equal(calls.snapshot, 2);
  assert.equal(refreshed.version, 6);

  // Cache persistido: nova aba/recarga do app reaproveita os dados (so confere o carimbo)
  const second = createSupabaseMock(state);
  const { Storage: reloadedStorage } = loadBrowserScript('public/assets/js/storage-supabase.js', {
    supabaseClient: second.client,
    localStorage: sharedStorage
  });
  const restored = await reloadedStorage.getData();
  assert.equal(restored.version, 6);
  assert.equal(second.calls.snapshot, 0);
  assert.equal(second.calls.version, 1);

  // Logout limpa o cache persistido
  await reloadedStorage.logout();
  assert.equal(sharedStorage.getItem('bolao_wdd_snapshot_v1'), null);
});

test('Storage.getRanking maps the database ranking and caches it per data version', async () => {
  const state = { version: 1 };
  const { client, calls } = createSupabaseMock(state);
  const { Storage: rankingStorage } = loadBrowserScript('public/assets/js/storage-supabase.js', {
    supabaseClient: client
  });

  const ranking = await rankingStorage.getRanking(null);
  await rankingStorage.getRanking('all');

  assert.equal(calls.ranking, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(ranking[0])), {
    id: 'u1', name: 'Daniel', position: 1, points: 10, exactHits: 1, nearMisses: 0, bonusHits: 0, betsCount: 1
  });

  await rankingStorage.getRanking('r1');
  assert.equal(calls.ranking, 2);
});

test('HTML pages only reference existing local assets', () => {
  const pages = ['login.html', 'admin.html', 'user.html', '404.html'];

  for (const page of pages) {
    const html = fs.readFileSync(path.join(rootDir, 'public', page), 'utf8');
    const references = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((match) => match[1]);

    for (const reference of references) {
      if (/^(https?:|#|mailto:)/.test(reference)) continue;

      const localPath = reference.split('?')[0];
      assert.ok(
        fs.existsSync(path.join(rootDir, 'public', localPath)),
        `${page} references missing asset ${reference}`
      );
    }
  }
});

test('Public HTML does not expose Firebase or public signup flow', () => {
  const pages = ['login.html', 'admin.html', 'user.html'];

  for (const page of pages) {
    const html = fs.readFileSync(path.join(rootDir, 'public', page), 'utf8').toLowerCase();

    assert.equal(html.includes('firebase'), false, `${page} should not reference Firebase`);
    assert.equal(html.includes('signup'), false, `${page} should not expose signup`);
    assert.equal(html.includes('register'), false, `${page} should not expose register`);
  }
});

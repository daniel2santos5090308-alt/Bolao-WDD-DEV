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
      correctResultPoints: 5,
      wrongPoints: 0,
      nearMissGoalDiff: 1,
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
  assert.equal(ranking[0].betsCount, 2);
  assert.equal(ranking[1].points, 14);
  assert.equal(ranking[1].hits, 1);
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

test('Storage.getData caches concurrent Supabase reads and returns cloned data', async () => {
  const rows = {
    profiles: [{ id: 'u1', legacy_id: 'u1', username: 'daniel', name: 'Daniel', role: 'user' }],
    rounds: [{ id: 'r1', name: 'Rodada 18', number: 17 }],
    matches: [],
    standings: [],
    scoring_settings: [{ id: 'default', exact_score_points: 10, near_miss_points: 7, correct_result_points: 5, wrong_points: 0, near_miss_goal_diff: 1, bonus_multiplier: 2, bonus_enabled: true }],
    bets: []
  };
  const calls = { from: 0, rpc: 0 };

  const makeQuery = (table) => ({
    select() {
      return this;
    },
    order() {
      return this;
    },
    eq() {
      return this;
    },
    maybeSingle: async () => ({ data: rows[table][0], error: null }),
    upsert: async () => ({ error: null }),
    then(resolve) {
      resolve({ data: rows[table], error: null });
    }
  });

  const { Storage: cachedStorage } = loadBrowserScript('public/assets/js/storage-supabase.js', {
    supabaseClient: {
      from(table) {
        calls.from += 1;
        return makeQuery(table);
      },
      rpc: async () => {
        calls.rpc += 1;
        return { data: rows.bets, error: null };
      }
    }
  });

  const [firstLoad, secondLoad] = await Promise.all([
    cachedStorage.getData(),
    cachedStorage.getData()
  ]);

  assert.equal(calls.from, 5);
  assert.equal(calls.rpc, 1);
  assert.deepEqual(firstLoad, secondLoad);

  firstLoad.rounds.push({ id: 'mutated', name: 'Mutated', number: 99 });
  const cachedLoad = await cachedStorage.getData();

  assert.equal(cachedLoad.rounds.length, 1);

  await cachedStorage.addRound({ id: 'r2', name: 'Rodada Cache', number: 18 });
  const updatedLoad = await cachedStorage.getData();

  assert.equal(updatedLoad.rounds.length, 2);
  assert.equal(updatedLoad.rounds[1].name, 'Rodada Cache');
});

test('HTML pages only reference existing local assets', () => {
  const pages = ['index.html', 'admin.html', 'user.html', '404.html'];

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
  const pages = ['index.html', 'admin.html', 'user.html'];

  for (const page of pages) {
    const html = fs.readFileSync(path.join(rootDir, 'public', page), 'utf8').toLowerCase();

    assert.equal(html.includes('firebase'), false, `${page} should not reference Firebase`);
    assert.equal(html.includes('signup'), false, `${page} should not expose signup`);
    assert.equal(html.includes('register'), false, `${page} should not expose register`);
  }
});

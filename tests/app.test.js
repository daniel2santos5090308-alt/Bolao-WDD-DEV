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

test('Ranking.calculate excludes admin and scores users by result odds', () => {
  const data = {
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
        odds: { home: 1.5, draw: 3.1, away: 4.2 }
      },
      {
        id: 'm2',
        homeTeam: 'C',
        awayTeam: 'D',
        result: 'draw',
        odds: { home: 2.1, draw: 3.25, away: 3.8 }
      }
    ],
    bets: {
      u1: { m1: { pick: 'home' }, m2: { pick: 'draw' } },
      u2: { m1: { pick: 'away' } }
    }
  };

  const ranking = Ranking.calculate(data);

  assert.deepEqual(ranking.map((user) => user.id), ['u1', 'u2']);
  assert.equal(ranking[0].points, 4.75);
  assert.equal(ranking[0].hits, 2);
  assert.equal(ranking[0].betsCount, 2);
  assert.equal(ranking[1].points, 0);
  assert.equal(ranking[1].hits, 0);
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
        odds: { home: 1.5, draw: 3.1, away: 4.2 }
      }
    ],
    bets: {
      u1: { m1: { pick: null } }
    }
  };

  const [user] = Ranking.calculate(data);

  assert.equal(user.betsCount, 1);
  assert.equal(user.points, 0);
  assert.equal(user.hits, 0);
  assert.equal(user.history.length, 1);
  assert.equal(user.history[0].pick, null);
});

test('Ranking.calculateByRound filters matches by round', () => {
  const data = {
    users: [{ id: 'u1', name: 'Daniel', role: 'user' }],
    matches: [
      { id: 'm1', roundId: 'r1', homeTeam: 'A', awayTeam: 'B', result: 'home', odds: { home: 2, draw: 3, away: 4 } },
      { id: 'm2', roundId: 'r2', homeTeam: 'C', awayTeam: 'D', result: 'away', odds: { home: 2, draw: 3, away: 5 } }
    ],
    bets: {
      u1: { m1: { pick: 'home' }, m2: { pick: 'away' } }
    }
  };

  const [roundRanking] = Ranking.calculateByRound(data, 'r2');

  assert.equal(roundRanking.points, 5);
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
    result: 'home',
    score_home: 2,
    score_away: 1
  });
});

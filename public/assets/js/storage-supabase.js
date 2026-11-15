/**
 * Gerenciamento de Dados (Supabase)
 */

const Storage = {
    SESSION_KEY: 'bolao_wdd_session',
    _cache: null,
    _cachePromise: null,
    _cacheLoadedAt: null,

    cloneData: (data) => JSON.parse(JSON.stringify(data || {
        users: [],
        rounds: [],
        matches: [],
        bets: {},
        standings: [],
        scoringSettings: Storage.getDefaultScoringSettings()
    })),

    getDefaultScoringSettings: () => ({
        id: 'default',
        exactScorePoints: 10,
        nearMissPoints: 7,
        correctResultPoints: 5,
        wrongPoints: 0,
        nearMissGoalDiff: 1,
        bonusMultiplier: 2,
        bonusEnabled: true
    }),

    setCache: (data) => {
        Storage._cache = Storage.cloneData(data);
        Storage._cacheLoadedAt = new Date().toISOString();
        Storage._lastVersionCheckAt = Date.now();
        Storage.persistCache();
    },

    clearCache: () => {
        Storage._cache = null;
        Storage._cachePromise = null;
        Storage._cacheLoadedAt = null;
        Storage._lastVersionCheckAt = 0;
        Storage._rankingCache = {};
    },

    updateCachedList: (listName, item) => {
        if (!Storage._cache || !Array.isArray(Storage._cache[listName])) return;

        const nextItem = Storage.cloneData(item);
        const index = Storage._cache[listName].findIndex((entry) => entry.id === nextItem.id);
        if (index >= 0) {
            Storage._cache[listName][index] = nextItem;
        } else {
            Storage._cache[listName].push(nextItem);
        }
        Storage.persistCache();
    },

    removeCachedListItem: (listName, id) => {
        if (!Storage._cache || !Array.isArray(Storage._cache[listName])) return;
        Storage._cache[listName] = Storage._cache[listName].filter((entry) => entry.id !== id);
        Storage.persistCache();
    },

    getLoginEmail: (username) => {
        const value = String(username || '').trim().toLowerCase();
        return value.includes('@') ? value : `${value}@bolao.local`;
    },

    getProfileByAuthId: async (authId) => {
        const { data, error } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', authId)
            .single();

        if (error) throw error;
        return data;
    },

    toUser: (profile) => ({
        id: profile.id,
        legacyId: profile.legacy_id,
        username: profile.username,
        name: profile.name,
        role: profile.role
    }),

    toRound: (round) => ({
        id: round.id,
        name: round.name,
        number: round.number
    }),

    toMatch: (match) => ({
        id: match.id,
        roundId: match.round_id,
        date: match.match_date,
        time: match.match_time ? String(match.match_time).slice(0, 5) : '',
        homeTeam: match.home_team,
        awayTeam: match.away_team,
        odds: {
            home: Number(match.odd_home || 1),
            draw: Number(match.odd_draw || 1),
            away: Number(match.odd_away || 1)
        },
        isBonus: Boolean(match.is_bonus),
        result: match.result,
        score: match.score_home === null || match.score_away === null ? null : {
            home: Number(match.score_home),
            away: Number(match.score_away)
        }
    }),

    toStanding: (standing) => ({
        id: standing.id,
        position: standing.position,
        team: standing.team,
        points: standing.points,
        played: standing.played,
        wins: standing.wins,
        draws: standing.draws,
        losses: standing.losses,
        goalsFor: standing.goals_for,
        goalsAgainst: standing.goals_against,
        goalDiff: standing.goal_diff
    }),

    fromMatch: (match) => ({
        id: match.id,
        round_id: match.roundId,
        match_date: match.date,
        match_time: match.time,
        home_team: match.homeTeam,
        away_team: match.awayTeam,
        odd_home: match.odds ? match.odds.home : 1,
        odd_draw: match.odds ? match.odds.draw : 1,
        odd_away: match.odds ? match.odds.away : 1,
        is_bonus: Boolean(match.isBonus),
        result: match.result || null,
        score_home: match.score ? match.score.home : null,
        score_away: match.score ? match.score.away : null
    }),

    toScoringSettings: (settings) => {
        const defaults = Storage.getDefaultScoringSettings();
        if (!settings) return defaults;
        return {
            id: settings.id || defaults.id,
            exactScorePoints: Number(settings.exact_score_points ?? defaults.exactScorePoints),
            nearMissPoints: Number(settings.near_miss_points ?? defaults.nearMissPoints),
            correctResultPoints: Number(settings.correct_result_points ?? defaults.correctResultPoints),
            wrongPoints: Number(settings.wrong_points ?? defaults.wrongPoints),
            nearMissGoalDiff: Number(settings.near_miss_goal_diff ?? defaults.nearMissGoalDiff),
            bonusMultiplier: Number(settings.bonus_multiplier ?? defaults.bonusMultiplier),
            bonusEnabled: settings.bonus_enabled ?? defaults.bonusEnabled
        };
    },

    fromScoringSettings: (settings) => ({
        id: settings.id || 'default',
        exact_score_points: Number(settings.exactScorePoints),
        near_miss_points: Number(settings.nearMissPoints),
        correct_result_points: Number(settings.correctResultPoints ?? settings.nearMissPoints),
        wrong_points: Number(settings.wrongPoints),
        near_miss_goal_diff: Number(settings.nearMissGoalDiff ?? 999),
        bonus_multiplier: Number(settings.bonusMultiplier),
        bonus_enabled: Boolean(settings.bonusEnabled),
        updated_at: new Date().toISOString()
    }),

    fromStanding: (standing) => ({
        id: standing.id,
        position: standing.position,
        team: standing.team,
        points: standing.points,
        played: standing.played,
        wins: standing.wins,
        draws: standing.draws,
        losses: standing.losses,
        goals_for: standing.goalsFor,
        goals_against: standing.goalsAgainst,
        goal_diff: standing.goalDiff
    }),

    /**
     * Controle de consumo (Fase 2):
     * - Os dados da temporada ativa vem de UMA chamada (get_app_snapshot).
     * - Ficam em memoria e no localStorage, junto com o "carimbo" app_meta.version.
     * - A cada VERSION_CHECK_MS, no maximo, o app consulta so o carimbo (poucos
     *   bytes). O snapshot so e baixado de novo quando o carimbo muda.
     * - "Atualizar" (forceRefresh) sempre baixa de novo.
     */
    VERSION_CHECK_MS: 60 * 1000,
    PERSIST_KEY: 'bolao_wdd_snapshot_v1',
    _lastVersionCheckAt: 0,
    _versionPromise: null,
    _rankingCache: {},

    persistCache: () => {
        try {
            const user = Storage.getCurrentUser();
            if (!user || !Storage._cache) return;
            localStorage.setItem(Storage.PERSIST_KEY, JSON.stringify({ userId: user.id, data: Storage._cache }));
        } catch (error) {
            // Armazenamento cheio/bloqueado: segue so com o cache em memoria
        }
    },

    restorePersistedCache: () => {
        try {
            const user = Storage.getCurrentUser();
            const raw = localStorage.getItem(Storage.PERSIST_KEY);
            if (!user || !raw) return false;
            const parsed = JSON.parse(raw);
            if (!parsed || parsed.userId !== user.id || !parsed.data) return false;
            Storage._cache = parsed.data;
            Storage._lastVersionCheckAt = 0;
            return true;
        } catch (error) {
            return false;
        }
    },

    clearPersistedCache: () => {
        try {
            localStorage.removeItem(Storage.PERSIST_KEY);
        } catch (error) {
            // ignora
        }
    },

    fetchVersion: async () => {
        const { data, error } = await supabaseClient.from('app_meta').select('version').eq('id', 1).maybeSingle();
        if (error) throw error;
        return data ? Number(data.version) : null;
    },

    getSeasonKey: () => (Storage._cache && Storage._cache.season ? Storage._cache.season.key : null),

    getData: async (options = {}) => {
        const forceRefresh = Boolean(options.forceRefresh);

        if (!forceRefresh && !Storage._cache) Storage.restorePersistedCache();

        if (!forceRefresh && Storage._cache) {
            if (Date.now() - Storage._lastVersionCheckAt < Storage.VERSION_CHECK_MS) {
                return Storage.cloneData(Storage._cache);
            }

            try {
                if (!Storage._versionPromise) {
                    Storage._versionPromise = Storage.fetchVersion()
                        .finally(() => { Storage._versionPromise = null; });
                }
                const version = await Storage._versionPromise;
                if (version !== null && version === Storage._cache.version) {
                    Storage._lastVersionCheckAt = Date.now();
                    return Storage.cloneData(Storage._cache);
                }
            } catch (error) {
                console.warn('Nao foi possivel verificar a versao dos dados. Usando cache local.', error);
                return Storage.cloneData(Storage._cache);
            }
        }

        if (!Storage._cachePromise) {
            Storage._cachePromise = Storage.fetchData()
                .finally(() => { Storage._cachePromise = null; });
        }

        try {
            return Storage.cloneData(await Storage._cachePromise);
        } catch (error) {
            // Sem rede: se houver cache, mostra o que temos; senao, propaga o erro para a tela
            if (Storage._cache) return Storage.cloneData(Storage._cache);
            throw error;
        }
    },

    fetchData: async () => {
        if (!supabaseClient) throw new Error('Supabase não inicializado');

        const { data: snapshot, error } = await supabaseClient.rpc('get_app_snapshot');
        if (error) {
            console.error('Erro ao buscar dados do Supabase:', error);
            throw error;
        }

        const data = Storage.fromSnapshot(snapshot || {});
        Storage.setCache(data);
        return data;
    },

    fromSnapshot: (snapshot) => {
        const bets = {};
        (snapshot.my_bets || []).forEach((bet) => {
            if (!bets[bet.user_id]) bets[bet.user_id] = {};
            bets[bet.user_id][bet.match_id] = Storage.toBet(bet);
        });

        return {
            version: snapshot.version === null || snapshot.version === undefined ? null : Number(snapshot.version),
            season: snapshot.season || null,
            users: (snapshot.profiles || []).map(Storage.toUser),
            rounds: (snapshot.rounds || []).map(Storage.toRound),
            matches: (snapshot.matches || []).map(Storage.toMatch),
            standings: (snapshot.standings || []).map(Storage.toStanding),
            scoringSettings: Storage.toScoringSettings(snapshot.scoring_settings),
            bets
        };
    },

    toBet: (bet) => ({
        pick: bet.pick,
        scoreHome: bet.score_home === null || bet.score_home === undefined ? null : Number(bet.score_home),
        scoreAway: bet.score_away === null || bet.score_away === undefined ? null : Number(bet.score_away),
        createdAt: bet.created_at
    }),

    /**
     * Ranking calculado no banco (get_ranking). Cacheado por versao + rodada.
     * roundId nulo/'all' = ranking da temporada.
     */
    getRanking: async (roundId = null) => {
        const data = await Storage.getData();
        const scope = roundId && roundId !== 'all' ? roundId : null;
        const cacheKey = `${data.version}|${data.season ? data.season.key : ''}|${scope || 'season'}`;

        if (Storage._rankingCache[cacheKey]) return Storage.cloneData(Storage._rankingCache[cacheKey]);

        const { data: rows, error } = await supabaseClient.rpc('get_ranking', {
            p_season_key: data.season ? data.season.key : null,
            p_round_id: scope
        });
        if (error) throw error;

        const ranking = (rows || []).map((row) => ({
            id: row.user_id,
            name: row.user_name,
            position: Number(row.position),
            points: Number(row.points),
            exactHits: Number(row.exact_hits),
            nearMisses: Number(row.near_misses),
            bonusHits: Number(row.bonus_hits),
            betsCount: Number(row.bets_count)
        }));

        // Mantem so os rankings da versao atual
        const versionPrefix = `${data.version}|`;
        Object.keys(Storage._rankingCache).forEach((key) => {
            if (!key.startsWith(versionPrefix)) delete Storage._rankingCache[key];
        });
        Storage._rankingCache[cacheKey] = ranking;
        return Storage.cloneData(ranking);
    },

    /**
     * Historico do ranking por rodada (get_ranking_history), cacheado por versao.
     * Retorna [] se a funcao ainda nao existir no banco (visual degrada sem quebrar).
     */
    getRankingHistory: async () => {
        const data = await Storage.getData();
        const cacheKey = `${data.version}|${data.season ? data.season.key : ''}|history`;
        if (Storage._rankingCache[cacheKey]) return Storage.cloneData(Storage._rankingCache[cacheKey]);

        const { data: rows, error } = await supabaseClient.rpc('get_ranking_history', {
            p_season_key: data.season ? data.season.key : null
        });
        if (error) {
            console.warn('Historico do ranking indisponivel:', error);
            return [];
        }

        const history = (rows || []).map((row) => ({
            roundId: row.round_id,
            roundNumber: Number(row.round_number),
            roundName: row.round_name,
            userId: row.user_id,
            userName: row.user_name,
            roundPoints: Number(row.round_points),
            roundPosition: Number(row.round_position),
            totalPoints: Number(row.total_points),
            position: Number(row.position)
        }));
        Storage._rankingCache[cacheKey] = history;
        return Storage.cloneData(history);
    },

    /**
     * Salva varios palpites numa unica chamada. Se o lote falhar (ex.: um jogo
     * fechou no meio do caminho), tenta um a um para salvar os que ainda podem.
     * Retorna { saved: [matchIds], failed: [matchIds] }.
     */
    saveBets: async (userId, bets) => {
        if (!bets.length) return { saved: [], failed: [] };
        const currentUser = Storage.getCurrentUser();
        const now = new Date().toISOString();
        const rows = bets.map((bet) => {
            const scoreHome = Number(bet.scoreHome);
            const scoreAway = Number(bet.scoreAway);
            return {
                user_id: userId,
                legacy_user_id: currentUser ? (currentUser.legacyId || userId) : userId,
                match_id: bet.matchId,
                pick: scoreHome > scoreAway ? 'home' : (scoreHome < scoreAway ? 'away' : 'draw'),
                score_home: scoreHome,
                score_away: scoreAway,
                created_at: bet.createdAt || now,
                updated_at: now
            };
        });

        const applyToCache = (row) => {
            if (!Storage._cache) return;
            if (!Storage._cache.bets[userId]) Storage._cache.bets[userId] = {};
            Storage._cache.bets[userId][row.match_id] = Storage.toBet(row);
        };

        const { error } = await supabaseClient.from('bets').upsert(rows, { onConflict: 'user_id,match_id' });
        if (!error) {
            rows.forEach(applyToCache);
            Storage.persistCache();
            return { saved: rows.map((row) => row.match_id), failed: [] };
        }

        console.warn('Lote de palpites recusado; tentando um a um.', error);
        const saved = [];
        const failed = [];
        for (const row of rows) {
            const { error: rowError } = await supabaseClient.from('bets').upsert(row, { onConflict: 'user_id,match_id' });
            if (rowError) {
                failed.push(row.match_id);
            } else {
                saved.push(row.match_id);
                applyToCache(row);
            }
        }
        Storage.persistCache();
        return { saved, failed };
    },

    /**
     * Apostas visiveis (com a regra de ocultacao do banco), filtradas.
     * Retorna lista { userId, matchId, pick, scoreHome, scoreAway, createdAt }.
     */
    getVisibleBets: async ({ roundId = null, userId = null } = {}) => {
        const seasonKey = Storage.getSeasonKey();
        const pageSize = 1000;
        const result = [];

        for (let from = 0; ; from += pageSize) {
            const { data: rows, error } = await supabaseClient
                .rpc('get_season_bets', {
                    p_season_key: seasonKey,
                    p_round_id: roundId && roundId !== 'all' ? roundId : null,
                    p_user_id: userId || null
                })
                .range(from, from + pageSize - 1);
            if (error) throw error;

            (rows || []).forEach((row) => result.push({ userId: row.user_id, matchId: row.match_id, ...Storage.toBet(row) }));
            if (!rows || rows.length < pageSize) break;
        }

        return result;
    },

    addRound: async (round) => {
        const { error } = await supabaseClient.from('rounds').upsert(round);
        if (error) console.error('Erro ao adicionar rodada:', error);
        if (!error) Storage.updateCachedList('rounds', round);
        return !error;
    },

    // Uma unica chamada: o banco remove jogos e apostas da rodada (ON DELETE CASCADE).
    deleteRound: async (roundId) => {
        const { error } = await supabaseClient.from('rounds').delete().eq('id', roundId);
        if (error) console.error('Erro ao deletar rodada:', error);
        if (!error && Storage._cache) {
            const removedMatchIds = new Set(Storage._cache.matches
                .filter((match) => match.roundId === roundId)
                .map((match) => match.id));
            Storage._cache.matches = Storage._cache.matches.filter((match) => match.roundId !== roundId);
            Object.keys(Storage._cache.bets || {}).forEach((userId) => {
                removedMatchIds.forEach((matchId) => delete Storage._cache.bets[userId][matchId]);
            });
            Storage.removeCachedListItem('rounds', roundId);
        }
        return !error;
    },

    // Atualiza varios jogos numa unica chamada (ex.: troca do jogo bonus).
    updateMatches: async (matches) => {
        if (!matches.length) return true;
        const { error } = await supabaseClient.from('matches').upsert(matches.map(Storage.fromMatch));
        if (error) console.error('Erro ao atualizar jogos:', error);
        if (!error) matches.forEach((match) => Storage.updateCachedList('matches', match));
        return !error;
    },

    // Grava a classificacao em lote: upsert das linhas + remocao das que sairam.
    replaceStandings: async (standings, removedIds = []) => {
        if (standings.length) {
            const { error } = await supabaseClient.from('standings').upsert(standings.map(Storage.fromStanding));
            if (error) {
                console.error('Erro ao salvar classificação em lote:', error);
                return false;
            }
            standings.forEach((standing) => Storage.updateCachedList('standings', standing));
        }

        if (removedIds.length) {
            const { error } = await supabaseClient.from('standings').delete().in('id', removedIds);
            if (error) {
                console.error('Erro ao remover linhas da classificação:', error);
                return false;
            }
            removedIds.forEach((id) => Storage.removeCachedListItem('standings', id));
        }

        return true;
    },

    addMatch: async (match) => {
        const { error } = await supabaseClient.from('matches').upsert(Storage.fromMatch(match));
        if (error) console.error('Erro ao adicionar jogo:', error);
        if (!error) Storage.updateCachedList('matches', match);
        return !error;
    },

    updateMatch: async (match) => {
        const { error } = await supabaseClient.from('matches').update(Storage.fromMatch(match)).eq('id', match.id);
        if (error) console.error('Erro ao atualizar jogo:', error);
        if (!error) Storage.updateCachedList('matches', match);
        return !error;
    },

    deleteMatch: async (matchId) => {
        const { error } = await supabaseClient.from('matches').delete().eq('id', matchId);
        if (error) console.error('Erro ao deletar jogo:', error);
        if (!error && Storage._cache) {
            Object.keys(Storage._cache.bets || {}).forEach((userId) => {
                delete Storage._cache.bets[userId][matchId];
            });
            Storage.removeCachedListItem('matches', matchId);
        }
        return !error;
    },

    addStanding: async (standing) => {
        const { error } = await supabaseClient.from('standings').upsert(Storage.fromStanding(standing));
        if (error) console.error('Erro ao adicionar classificação:', error);
        if (!error) Storage.updateCachedList('standings', standing);
        return !error;
    },

    updateStanding: async (standing) => {
        const { error } = await supabaseClient.from('standings').update(Storage.fromStanding(standing)).eq('id', standing.id);
        if (error) console.error('Erro ao atualizar classificação:', error);
        if (!error) Storage.updateCachedList('standings', standing);
        return !error;
    },

    deleteStanding: async (standingId) => {
        const { error } = await supabaseClient.from('standings').delete().eq('id', standingId);
        if (error) console.error('Erro ao deletar classificação:', error);
        if (!error) Storage.removeCachedListItem('standings', standingId);
        return !error;
    },

    updateScoringSettings: async (settings) => {
        const nextSettings = {
            ...Storage.getDefaultScoringSettings(),
            ...(settings || {}),
            id: 'default'
        };

        const { error } = await supabaseClient
            .from('scoring_settings')
            .upsert(Storage.fromScoringSettings(nextSettings), { onConflict: 'id' });

        if (error) console.error('Erro ao atualizar pontuação:', error);
        if (!error && Storage._cache) {
            Storage._cache.scoringSettings = Storage.cloneData(nextSettings);
            Storage.persistCache();
        }
        return !error;
    },

    saveBet: async (userId, matchId, betValue) => {
        const currentUser = Storage.getCurrentUser();
        const scoreHome = Number.isInteger(Number(betValue.scoreHome)) ? Number(betValue.scoreHome) : null;
        const scoreAway = Number.isInteger(Number(betValue.scoreAway)) ? Number(betValue.scoreAway) : null;
        const computedPick = scoreHome === null || scoreAway === null
            ? (betValue.pick || null)
            : (scoreHome > scoreAway ? 'home' : (scoreHome < scoreAway ? 'away' : 'draw'));
        const payload = {
            user_id: userId,
            legacy_user_id: currentUser ? (currentUser.legacyId || currentUser.legacy_id || userId) : userId,
            match_id: matchId,
            pick: computedPick,
            score_home: scoreHome,
            score_away: scoreAway,
            created_at: betValue.createdAt || new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        const { error } = await supabaseClient
            .from('bets')
            .upsert(payload, { onConflict: 'user_id,match_id' });

        if (error) console.error('Erro ao salvar aposta:', error);
        if (!error && Storage._cache) {
            if (!Storage._cache.bets[userId]) Storage._cache.bets[userId] = {};
            Storage._cache.bets[userId][matchId] = {
                pick: computedPick,
                scoreHome,
                scoreAway,
                createdAt: payload.created_at
            };
            Storage.persistCache();
        }
        return !error;
    },

    ensureAdminExists: async () => false,

    updateUserPassword: async (userId, newPassword) => {
        const currentUser = Storage.getCurrentUser();
        if (!currentUser || currentUser.id !== userId) return false;

        const { error } = await supabaseClient.auth.updateUser({ password: newPassword });
        if (error) console.error('Erro ao mudar senha:', error);
        return !error;
    },

    updateUserPasswordWithCurrent: async (currentPassword, newPassword) => {
        const currentUser = Storage.getCurrentUser();
        if (!currentUser) return false;

        const { error: signInError } = await supabaseClient.auth.signInWithPassword({
            email: Storage.getLoginEmail(currentUser.username),
            password: currentPassword
        });

        if (signInError) {
            console.error('Senha atual inválida:', signInError);
            return false;
        }

        const { error } = await supabaseClient.auth.updateUser({ password: newPassword });
        if (error) console.error('Erro ao mudar senha:', error);
        return !error;
    },

    resetData: async () => {
        console.warn('Reset de dados desabilitado no cliente Supabase.');
        return false;
    },

    migrateFromJSON: async (jsonData) => {
        console.warn('Importação JSON desabilitada no cliente Supabase.', jsonData);
        return false;
    },

    login: async (username, password) => {
        try {
            const { data, error } = await supabaseClient.auth.signInWithPassword({
                email: Storage.getLoginEmail(username),
                password
            });

            if (error || !data.user) {
                if (error) console.error('Erro no login:', error);
                return null;
            }

            const profile = await Storage.getProfileByAuthId(data.user.id);
            const sessionUser = Storage.toUser(profile);
            localStorage.setItem(Storage.SESSION_KEY, JSON.stringify(sessionUser));
            return sessionUser;
        } catch (e) {
            console.error('Erro no login:', e);
            return null;
        }
    },

    logout: async () => {
        localStorage.removeItem(Storage.SESSION_KEY);
        Storage.clearCache();
        Storage.clearPersistedCache();
        if (supabaseClient) await supabaseClient.auth.signOut();
    },

    getCurrentUser: () => {
        const userStr = localStorage.getItem(Storage.SESSION_KEY);
        return userStr ? JSON.parse(userStr) : null;
    }
};

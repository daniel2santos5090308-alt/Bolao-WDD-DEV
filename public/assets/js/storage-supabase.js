/**
 * Gerenciamento de Dados (Supabase)
 */

const Storage = {
    SESSION_KEY: 'bolao_wdd_session',

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
            home: Number(match.odd_home),
            draw: Number(match.odd_draw),
            away: Number(match.odd_away)
        },
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
        odd_home: match.odds ? match.odds.home : null,
        odd_draw: match.odds ? match.odds.draw : null,
        odd_away: match.odds ? match.odds.away : null,
        result: match.result || null,
        score_home: match.score ? match.score.home : null,
        score_away: match.score ? match.score.away : null
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

    getData: async () => {
        try {
            if (!supabaseClient) throw new Error('Supabase nao inicializado');

            const [profilesRes, roundsRes, matchesRes, standingsRes] = await Promise.all([
                supabaseClient.from('profiles').select('*').order('username'),
                supabaseClient.from('rounds').select('*').order('number'),
                supabaseClient.from('matches').select('*').order('match_date').order('match_time'),
                supabaseClient.from('standings').select('*').order('position')
            ]);

            let betsRes = await supabaseClient.rpc('get_visible_bets');
            if (betsRes.error) {
                console.warn('Funcao get_visible_bets indisponivel. Usando leitura direta temporaria de bets.', betsRes.error);
                betsRes = await supabaseClient.from('bets').select('*');
            }

            const responses = [profilesRes, roundsRes, matchesRes, standingsRes, betsRes];
            const failed = responses.find((response) => response.error);
            if (failed) throw failed.error;

            const users = profilesRes.data.map(Storage.toUser);
            const rounds = roundsRes.data.map(Storage.toRound);
            const matches = matchesRes.data.map(Storage.toMatch);
            const standings = standingsRes.data.map(Storage.toStanding);
            const bets = {};

            betsRes.data.forEach((bet) => {
                if (!bets[bet.user_id]) bets[bet.user_id] = {};
                bets[bet.user_id][bet.match_id] = {
                    pick: bet.pick,
                    createdAt: bet.created_at
                };
            });

            return { users, rounds, matches, bets, standings };
        } catch (error) {
            console.error('Erro ao buscar dados do Supabase:', error);
            alert('Erro critico: falha ao conectar com o banco de dados.');
            return { users: [], rounds: [], matches: [], bets: {}, standings: [] };
        }
    },

    addRound: async (round) => {
        const { error } = await supabaseClient.from('rounds').upsert(round);
        if (error) console.error('Erro ao adicionar rodada:', error);
        return !error;
    },

    deleteRound: async (roundId) => {
        const { error } = await supabaseClient.from('rounds').delete().eq('id', roundId);
        if (error) console.error('Erro ao deletar rodada:', error);
        return !error;
    },

    addMatch: async (match) => {
        const { error } = await supabaseClient.from('matches').upsert(Storage.fromMatch(match));
        if (error) console.error('Erro ao adicionar jogo:', error);
        return !error;
    },

    updateMatch: async (match) => {
        const { error } = await supabaseClient.from('matches').update(Storage.fromMatch(match)).eq('id', match.id);
        if (error) console.error('Erro ao atualizar jogo:', error);
        return !error;
    },

    deleteMatch: async (matchId) => {
        const { error } = await supabaseClient.from('matches').delete().eq('id', matchId);
        if (error) console.error('Erro ao deletar jogo:', error);
        return !error;
    },

    addStanding: async (standing) => {
        const { error } = await supabaseClient.from('standings').upsert(Storage.fromStanding(standing));
        if (error) console.error('Erro ao adicionar classificacao:', error);
        return !error;
    },

    updateStanding: async (standing) => {
        const { error } = await supabaseClient.from('standings').update(Storage.fromStanding(standing)).eq('id', standing.id);
        if (error) console.error('Erro ao atualizar classificacao:', error);
        return !error;
    },

    deleteStanding: async (standingId) => {
        const { error } = await supabaseClient.from('standings').delete().eq('id', standingId);
        if (error) console.error('Erro ao deletar classificacao:', error);
        return !error;
    },

    saveBet: async (userId, matchId, betValue) => {
        const currentUser = Storage.getCurrentUser();
        const payload = {
            user_id: userId,
            legacy_user_id: currentUser ? (currentUser.legacyId || currentUser.legacy_id || userId) : userId,
            match_id: matchId,
            pick: betValue.pick,
            created_at: betValue.createdAt || new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        const { error } = await supabaseClient
            .from('bets')
            .upsert(payload, { onConflict: 'user_id,match_id' });

        if (error) console.error('Erro ao salvar aposta:', error);
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
            console.error('Senha atual invalida:', signInError);
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
        console.warn('Importacao JSON desabilitada no cliente Supabase.', jsonData);
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
        if (supabaseClient) await supabaseClient.auth.signOut();
    },

    getCurrentUser: () => {
        const userStr = localStorage.getItem(Storage.SESSION_KEY);
        return userStr ? JSON.parse(userStr) : null;
    }
};

/**
 * Calculo e exibicao do ranking
 */

const Ranking = {
    getSettings: (data) => ({
        exactScorePoints: 10,
        nearMissPoints: 7,
        correctResultPoints: 5,
        wrongPoints: 0,
        nearMissGoalDiff: 1,
        bonusMultiplier: 2,
        bonusEnabled: true,
        ...(data && data.scoringSettings ? data.scoringSettings : {})
    }),

    getResultFromScore: (score) => {
        if (!score) return null;
        const home = Number(score.home);
        const away = Number(score.away);
        if (!Number.isFinite(home) || !Number.isFinite(away)) return null;
        if (home > away) return 'home';
        if (home < away) return 'away';
        return 'draw';
    },

    getBetScore: (bet) => {
        if (!bet) return null;
        const home = bet.scoreHome ?? bet.score_home;
        const away = bet.scoreAway ?? bet.score_away;
        if (home === null || home === undefined || away === null || away === undefined) return null;
        const score = { home: Number(home), away: Number(away) };
        if (!Number.isInteger(score.home) || !Number.isInteger(score.away)) return null;
        return score;
    },

    calculateMatchPoints: (match, bet, settings) => {
        const betScore = Ranking.getBetScore(bet);
        const finalScore = match && match.score ? {
            home: Number(match.score.home),
            away: Number(match.score.away)
        } : null;

        const emptyResult = {
            betScore,
            finalScore,
            points: 0,
            basePoints: 0,
            multiplier: 1,
            isHit: false,
            isExact: false,
            isNearMiss: false,
            isCorrectResult: false,
            label: 'Aguardando'
        };

        if (!betScore || !finalScore || !Number.isFinite(finalScore.home) || !Number.isFinite(finalScore.away)) {
            return emptyResult;
        }

        const betResult = Ranking.getResultFromScore(betScore);
        const finalResult = Ranking.getResultFromScore(finalScore);
        const homeDiff = Math.abs(betScore.home - finalScore.home);
        const awayDiff = Math.abs(betScore.away - finalScore.away);
        const threshold = Math.max(0, Number(settings.nearMissGoalDiff || 0));

        let basePoints = Number(settings.wrongPoints || 0);
        let label = 'Errou';
        let isExact = false;
        let isNearMiss = false;
        let isCorrectResult = false;

        if (betScore.home === finalScore.home && betScore.away === finalScore.away) {
            basePoints = Number(settings.exactScorePoints || 0);
            label = 'Placar exato';
            isExact = true;
            isCorrectResult = true;
        } else if (betResult === finalResult && homeDiff <= threshold && awayDiff <= threshold) {
            basePoints = Number(settings.nearMissPoints || 0);
            label = 'Na trave';
            isNearMiss = true;
            isCorrectResult = true;
        } else if (betResult === finalResult) {
            basePoints = Number(settings.correctResultPoints || 0);
            label = 'Resultado certo';
            isCorrectResult = true;
        }

        const multiplier = settings.bonusEnabled && match.isBonus ? Number(settings.bonusMultiplier || 1) : 1;
        const points = Math.round(basePoints * multiplier * 100) / 100;

        return {
            betScore,
            finalScore,
            points,
            basePoints,
            multiplier,
            isHit: points > 0,
            isExact,
            isNearMiss,
            isCorrectResult,
            label
        };
    },

    calculateForMatches: (data, matches) => {
        const safeUsers = Array.isArray(data.users) ? data.users : [];
        const safeMatches = Array.isArray(matches) ? matches : [];
        const safeBets = data.bets && typeof data.bets === 'object' ? data.bets : {};
        const settings = Ranking.getSettings(data);
        const users = safeUsers.filter(u => u.role !== 'admin');

        const ranking = users.map(user => {
            let points = 0;
            let hits = 0;
            let exactHits = 0;
            let nearMisses = 0;
            let resultHits = 0;
            let betsCount = 0;
            const history = [];
            const processedMatches = new Set();
            const userBets = safeBets[user.id] || {};

            safeMatches.forEach(match => {
                if (!match || !match.id) return;
                if (processedMatches.has(match.id)) return;
                processedMatches.add(match.id);

                const userBet = userBets[match.id];
                if (!userBet) return;

                betsCount++;
                const scoreResult = Ranking.calculateMatchPoints(match, userBet, settings);
                points = (Math.round(points * 100) + Math.round(scoreResult.points * 100)) / 100;

                if (scoreResult.isExact) exactHits++;
                if (scoreResult.isNearMiss) nearMisses++;
                if (scoreResult.isCorrectResult) resultHits++;
                if (scoreResult.isHit) hits++;

                history.push({
                    match: `${match.homeTeam} x ${match.awayTeam}`,
                    date: match.date,
                    time: match.time,
                    pick: userBet.pick,
                    betScore: scoreResult.betScore,
                    finalScore: match.score || null,
                    result: match.result,
                    points: scoreResult.points,
                    basePoints: scoreResult.basePoints,
                    multiplier: scoreResult.multiplier,
                    isHit: scoreResult.isHit,
                    isExact: scoreResult.isExact,
                    isNearMiss: scoreResult.isNearMiss,
                    isCorrectResult: scoreResult.isCorrectResult,
                    label: scoreResult.label,
                    isBonus: Boolean(match.isBonus),
                    isFinished: !!match.result
                });
            });

            return {
                id: user.id,
                name: user.name,
                points: parseFloat(points.toFixed(2)),
                hits,
                exactHits,
                nearMisses,
                resultHits,
                betsCount,
                history
            };
        });

        ranking.sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            if (b.exactHits !== a.exactHits) return b.exactHits - a.exactHits;
            return b.hits - a.hits;
        });

        return ranking;
    },

    calculate: (data) => {
        const matches = Array.isArray(data.matches) ? data.matches : [];
        return Ranking.calculateForMatches(data, matches);
    },

    calculateByRound: (data, roundId) => {
        const matches = Array.isArray(data.matches) ? data.matches : [];
        if (!roundId || roundId === 'all') return Ranking.calculateForMatches(data, matches);
        const filtered = matches.filter(m => m && m.roundId === roundId);
        return Ranking.calculateForMatches(data, filtered);
    },

    render: async (containerId, providedData = null) => {
        const data = providedData || await Storage.getData();
        const rankingData = Ranking.calculate(data);
        const container = document.getElementById(containerId);
        if (!container) return;

        window.currentRankingData = rankingData;
        container.innerHTML = '';

        if (rankingData.length === 0) {
            container.innerHTML = '<tr><td colspan="6" class="text-center">Sem dados.</td></tr>';
            return;
        }

        rankingData.forEach((r, index) => {
            const tr = document.createElement('tr');
            if (index === 0) tr.classList.add('table-warning', 'fw-bold');

            tr.innerHTML = `
                <td>${index + 1}º</td>
                <td>${Utils.escapeHtml(r.name)}</td>
                <td class="text-center">${r.points.toFixed(2)}</td>
                <td class="text-center">${r.exactHits}</td>
                <td class="text-center">${r.betsCount}</td>
                <td class="text-center">
                    <button class="btn btn-sm btn-info text-white" onclick="Ranking.showDetails('${r.id}')" title="Ver Extrato">
                        <i class="bi bi-list-ul"></i> Detalhes
                    </button>
                </td>
            `;
            container.appendChild(tr);
        });
    },

    renderRound: async (containerId, roundId, providedData = null) => {
        const container = document.getElementById(containerId);
        if (!container) return;

        const data = providedData || await Storage.getData();
        const rounds = Array.isArray(data.rounds) ? data.rounds : [];
        const titleEl = document.getElementById('roundRankingTitle');
        const summaryEl = document.getElementById('roundRankingSummary');

        if (!roundId || roundId === 'all') {
            if (titleEl) titleEl.textContent = 'Selecione uma rodada no filtro acima';
            if (summaryEl) summaryEl.innerHTML = '';
            container.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Selecione uma rodada para ver o ranking desta rodada.</td></tr>';
            window.currentRoundRankingData = [];
            window.currentRoundRankingId = null;
            return;
        }

        const round = rounds.find(r => r && r.id === roundId);
        if (titleEl) titleEl.textContent = round && round.name ? round.name : 'Rodada';

        const rankingData = Ranking.calculateByRound(data, roundId);
        window.currentRoundRankingData = rankingData;
        window.currentRoundRankingId = roundId;
        container.innerHTML = '';

        if (rankingData.length === 0) {
            if (summaryEl) summaryEl.innerHTML = '';
            container.innerHTML = '<tr><td colspan="6" class="text-center">Sem dados.</td></tr>';
            return;
        }

        const best = rankingData[0];
        if (summaryEl) {
            summaryEl.innerHTML = `<span class="fw-bold">Melhor da rodada:</span> ${Utils.escapeHtml(best.name)} (${best.points.toFixed(2)} pts)`;
        }

        rankingData.forEach((r, index) => {
            const tr = document.createElement('tr');
            if (index === 0) tr.classList.add('table-warning', 'fw-bold');

            tr.innerHTML = `
                <td>${index + 1}º</td>
                <td>${Utils.escapeHtml(r.name)}</td>
                <td class="text-center">${r.points.toFixed(2)}</td>
                <td class="text-center">${r.exactHits}</td>
                <td class="text-center">${r.betsCount}</td>
                <td class="text-center">
                    <button class="btn btn-sm btn-info text-white" onclick="Ranking.showRoundDetails('${r.id}')" title="Ver Extrato da Rodada">
                        <i class="bi bi-list-ul"></i> Detalhes
                    </button>
                </td>
            `;
            container.appendChild(tr);
        });
    },

    openDetailsModal: (user, titlePrefix) => {
        if (!user) return;

        const currentUser = Storage.getCurrentUser();
        const isSelf = !!(currentUser && currentUser.id === user.id);
        const modalTitle = document.getElementById('rankingModalTitle');
        const modalBody = document.getElementById('rankingModalBody');

        if (modalTitle) modalTitle.textContent = `${titlePrefix} - ${user.name}`;
        if (modalBody) {
            if (!user.history || user.history.length === 0) {
                modalBody.innerHTML = '<p class="text-center text-muted">Nenhuma aposta registrada.</p>';
            } else {
                let html = '<div class="list-group">';
                const sortedHistory = [...user.history].sort((a, b) => new Date(`${b.date}T${b.time || '00:00'}`) - new Date(`${a.date}T${a.time || '00:00'}`));

                sortedHistory.forEach(h => {
                    let itemClass = '';
                    let icon = '';
                    let pointsText = '';

                    if (!h.isFinished) {
                        itemClass = 'list-group-item-light';
                        icon = '<span class="badge bg-secondary">Aberto</span>';
                        pointsText = '-';
                    } else if (h.isHit) {
                        itemClass = 'list-group-item-success';
                        icon = `<span class="badge bg-success">${Utils.escapeHtml(h.label || 'Acertou')}</span>`;
                        pointsText = `+${h.points.toFixed(2)}`;
                    } else {
                        itemClass = 'list-group-item-danger';
                        icon = '<span class="badge bg-danger">Errou</span>';
                        pointsText = Number(h.points || 0).toFixed(2);
                    }

                    const isLocked = h.time ? Utils.isMatchLocked(h.date, h.time) : h.isFinished;
                    const canRevealPick = isSelf || isLocked;
                    const pickText = canRevealPick && h.betScore
                        ? `<strong>${Number(h.betScore.home)} x ${Number(h.betScore.away)}</strong>`
                        : '<em>Oculta ate o inicio do jogo</em>';
                    const finalScoreText = h.finalScore
                        ? `${Number(h.finalScore.home)} x ${Number(h.finalScore.away)}`
                        : 'Aguardando';
                    const bonusText = h.isBonus && h.multiplier > 1 ? ` | Bonus ${h.multiplier}x` : '';

                    html += `
                        <div class="list-group-item ${itemClass} d-flex justify-content-between align-items-center">
                            <div>
                                <div class="fw-bold">${Utils.escapeHtml(h.match)} ${h.isBonus ? '<span class="badge bg-warning text-dark ms-1">Bonus</span>' : ''}</div>
                                <div class="small mt-1">
                                    <span class="me-2">Aposta: ${pickText}</span>
                                    <span>Resultado: <strong>${finalScoreText}</strong></span>
                                </div>
                                ${h.isFinished ? `<div class="small ${h.isHit ? 'text-success' : 'text-muted'}">${Utils.escapeHtml(h.label || 'Resultado')} | Base: ${Number(h.basePoints || 0).toFixed(2)}${bonusText} | Ganhou: +${Number(h.points || 0).toFixed(2)}</div>` : ''}
                            </div>
                            <div class="text-end">
                                <div>${icon}</div>
                                <div class="fw-bold fs-5">${pointsText}</div>
                            </div>
                        </div>
                    `;
                });
                html += '</div>';
                modalBody.innerHTML = html;
            }
        }

        const modalEl = document.getElementById('rankingModal');
        if (modalEl) {
            const modal = new bootstrap.Modal(modalEl);
            modal.show();
        }
    },

    showDetails: (userId) => {
        const user = (window.currentRankingData || []).find(u => u.id === userId);
        if (!user) return;
        Ranking.openDetailsModal(user, 'Extrato de Pontos');
    },

    showRoundDetails: (userId) => {
        const user = (window.currentRoundRankingData || []).find(u => u.id === userId);
        if (!user) return;

        const titleEl = document.getElementById('roundRankingTitle');
        const roundName = titleEl && titleEl.textContent ? titleEl.textContent : 'Rodada';
        Ranking.openDetailsModal(user, `Extrato da Rodada (${roundName})`);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('rankingTableBody')) {
        Ranking.render('rankingTableBody');
    }
});

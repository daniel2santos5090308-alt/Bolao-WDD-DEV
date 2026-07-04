/**
 * Cálculo e Exibição do Ranking
 */

const Ranking = {
    POINTS_PER_HIT: 1,

    calculateForMatches: (data, matches) => {
        const safeUsers = Array.isArray(data.users) ? data.users : [];
        const safeMatches = Array.isArray(matches) ? matches : [];
        const safeBets = data.bets && typeof data.bets === 'object' ? data.bets : {};

        const users = safeUsers.filter(u => u.role !== 'admin');

        const ranking = users.map(user => {
            let points = 0;
            let hits = 0;
            let betsCount = 0;
            const history = [];

            const processedMatches = new Set();
            const userBets = safeBets[user.id] || {};

            safeMatches.forEach(match => {
                if (!match || !match.id) return;
                if (processedMatches.has(match.id)) return;
                processedMatches.add(match.id);

                let pointsEarned = 0;
                let isHit = false;
                let userPick = null;

                if (userBets[match.id]) {
                    betsCount++;
                    userPick = userBets[match.id].pick;

                    if (userPick && match.result) {
                        const safePick = String(userPick).trim();
                        const safeResult = String(match.result).trim();

                        if (safePick === safeResult) {
                            hits++;
                            isHit = true;
                            const oddValue = match.odds ? Number(match.odds[match.result]) : NaN;
                            if (!isNaN(oddValue)) {
                                pointsEarned = oddValue;
                                points = (Math.round(points * 100) + Math.round(pointsEarned * 100)) / 100;
                            }
                        }
                    }
                }

                if (userBets[match.id]) {
                    history.push({
                        match: `${match.homeTeam} x ${match.awayTeam}`,
                        date: match.date,
                        time: match.time,
                        pick: userPick,
                        result: match.result,
                        points: pointsEarned,
                        odd: match.result && match.odds ? match.odds[match.result] : 0,
                        isHit: isHit,
                        isFinished: !!match.result
                    });
                }
            });

            return {
                id: user.id,
                name: user.name,
                points: parseFloat(points.toFixed(2)),
                hits,
                betsCount,
                history
            };
        });

        ranking.sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
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
                <td class="text-center">${r.hits}</td>
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
                <td class="text-center">${r.hits}</td>
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
                    const resultMap = { 'home': 'Casa', 'draw': 'Empate', 'away': 'Fora' };
                    let itemClass = '';
                    let icon = '';
                    let pointsText = '';

                    if (!h.isFinished) {
                        itemClass = 'list-group-item-light';
                        icon = '<span class="badge bg-secondary">Aberto</span>';
                        pointsText = '-';
                    } else if (h.isHit) {
                        itemClass = 'list-group-item-success';
                        icon = '<span class="badge bg-success">Acertou</span>';
                        pointsText = `+${h.points.toFixed(2)}`;
                    } else {
                        itemClass = 'list-group-item-danger';
                        icon = '<span class="badge bg-danger">Errou</span>';
                        pointsText = '0.00';
                    }

                    const isLocked = h.time ? Utils.isMatchLocked(h.date, h.time) : h.isFinished;
                    const canRevealPick = isSelf || isLocked;
                    const pickText = canRevealPick && h.pick ? `<strong>${resultMap[h.pick]}</strong>` : '<em>Oculta até o início do jogo</em>';

                    const oddText = (h.isHit && h.odd !== null && h.odd !== undefined) ? Number(h.odd).toFixed(2) : '0.00';

                    html += `
                        <div class="list-group-item ${itemClass} d-flex justify-content-between align-items-center">
                            <div>
                                <div class="fw-bold">${Utils.escapeHtml(h.match)}</div>
                                <div class="small mt-1">
                                    <span class="me-2">Aposta: ${pickText}</span>
                                    <span>Resultado: <strong>${h.result ? resultMap[h.result] : 'Aguardando'}</strong></span>
                                </div>
                                ${h.isHit ? `<div class="small text-success">Odd: ${oddText} | Ganhou: +${h.points.toFixed(2)}</div>` : ''}
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

// Auto-renderizar se houver tabela na página
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('rankingTableBody')) {
        Ranking.render('rankingTableBody');
    }
});

/**
 * Lógica do Painel de Usuário
 */

document.addEventListener('DOMContentLoaded', () => {
    // Verificar login mas permitir que admin também acesse para ver como está (opcional, mas bom pra teste)
    // Auth.checkLogin() já foi chamado no HTML provavelmente ou podemos chamar aqui
    const currentUser = Storage.getCurrentUser();
    if (!currentUser) {
        window.location.href = 'index.html';
        return;
    }
    
    document.getElementById('userNameDisplay').textContent = currentUser.name;
    document.getElementById('btnLogout').addEventListener('click', (e) => {
        e.preventDefault();
        Auth.logout();
    });

    const matchesContainer = document.getElementById('matchesContainer');
    const roundFilter = document.getElementById('roundFilter');
    const teamFilter = document.getElementById('teamFilter');
    const btnRefresh = document.getElementById('btnRefresh');
    const btnThemeToggle = document.getElementById('btnThemeToggle');
    const paginationContainer = document.getElementById('matchesPagination');
    const standingsTableUserBody = document.getElementById('standingsTableUserBody');
    const dashboardHighlights = document.getElementById('dashboardHighlights');
    const roundHighlights = document.getElementById('roundHighlights');
    const generalInsights = document.getElementById('generalInsights');
    const pageSize = 5;
    let currentPage = 1;
    let cachedData = null;

    setupTabs();
    setupTheme();
    setupWelcomeModal();

    if (btnRefresh) {
        btnRefresh.addEventListener('click', () => {
            loadRoundsAndMatches({ forceRefresh: true });
            // Feedback visual
            const icon = btnRefresh.querySelector('i');
            icon.classList.add('spin-animation'); // Adicionar CSS para girar
            setTimeout(() => icon.classList.remove('spin-animation'), 1000);
        });
    }

    function setupTabs() {
        document.querySelectorAll('[data-tab-target]').forEach((button) => {
            button.addEventListener('click', () => {
                const targetId = button.getAttribute('data-tab-target');
                document.querySelectorAll('[data-tab-target]').forEach(item => item.classList.remove('active'));
                document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));
                button.classList.add('active');
                const target = document.getElementById(targetId);
                if (target) target.classList.add('active');
            });
        });
    }

    function setupTheme() {
        const savedTheme = localStorage.getItem('bolao_wdd_theme') || 'light';
        document.body.classList.toggle('theme-dark', savedTheme === 'dark');
        updateThemeButton(savedTheme);

        if (!btnThemeToggle) return;
        btnThemeToggle.addEventListener('click', () => {
            const isDark = !document.body.classList.contains('theme-dark');
            document.body.classList.toggle('theme-dark', isDark);
            const nextTheme = isDark ? 'dark' : 'light';
            localStorage.setItem('bolao_wdd_theme', nextTheme);
            updateThemeButton(nextTheme);
        });
    }

    function updateThemeButton(theme) {
        if (!btnThemeToggle) return;
        btnThemeToggle.innerHTML = theme === 'dark'
            ? '<i class="bi bi-sun"></i>'
            : '<i class="bi bi-moon-stars"></i>';
    }

    function setupWelcomeModal() {
        const modalEl = document.getElementById('welcomeModal');
        const confirmButton = document.getElementById('welcomeModalConfirm');
        const storageKey = 'bolao_wdd_welcome_prod_2026_07_25_12';
        const expiresAt = new Date(2026, 6, 25, 12, 0, 0);

        if (!modalEl || new Date() >= expiresAt || typeof bootstrap === 'undefined') return;

        try {
            if (localStorage.getItem(storageKey) === 'dismissed') return;
        } catch (error) {
            console.warn('Nao foi possivel ler a confirmacao do aviso de boas-vindas.', error);
        }

        const modal = new bootstrap.Modal(modalEl);
        modal.show();

        if (confirmButton) {
            confirmButton.addEventListener('click', () => {
                try {
                    localStorage.setItem(storageKey, 'dismissed');
                } catch (error) {
                    console.warn('Nao foi possivel salvar a confirmacao do aviso de boas-vindas.', error);
                }
            }, { once: true });
        }
    }

    function getStandingZone(position) {
        const pos = Number(position);
        if (!Number.isFinite(pos)) return '';
        if (pos >= 1 && pos <= 4) return 'standing-row--lib-group';
        if (pos === 5) return 'standing-row--lib-qual';
        if (pos >= 6 && pos <= 11) return 'standing-row--sula';
        if (pos >= 17 && pos <= 20) return 'standing-row--relegation';
        return '';
    }

    function renderStandings(standings) {
        if (!standingsTableUserBody) return;

        const sortedStandings = Array.isArray(standings)
            ? [...standings].sort((a, b) => {
                if ((a.position ?? 999) !== (b.position ?? 999)) return (a.position ?? 999) - (b.position ?? 999);
                return String(a.team || '').localeCompare(String(b.team || ''), 'pt-BR');
            })
            : [];

        standingsTableUserBody.innerHTML = '';

        if (sortedStandings.length === 0) {
            standingsTableUserBody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">Classificação ainda não cadastrada.</td></tr>';
            return;
        }

        sortedStandings.forEach((standing) => {
            const tr = document.createElement('tr');
            const teamDisplay = typeof Teams !== 'undefined'
                ? Teams.getTeamMarkup(standing.team, { size: 'sm', layout: 'row' })
                : standing.team;
            const goalDiff = Number.isFinite(Number(standing.goalDiff))
                ? Number(standing.goalDiff)
                : Number(standing.goalsFor || 0) - Number(standing.goalsAgainst || 0);
            const zoneClass = getStandingZone(standing.position);

            if (zoneClass) tr.classList.add(zoneClass);

            tr.innerHTML = `
                <td>${standing.position ?? '-'}</td>
                <td>${teamDisplay}</td>
                <td class="text-center fw-semibold">${standing.points ?? 0}</td>
                <td class="text-center">${standing.played ?? 0}</td>
                <td class="text-center">${standing.wins ?? 0}</td>
                <td class="text-center">${standing.draws ?? 0}</td>
                <td class="text-center">${standing.losses ?? 0}</td>
                <td class="text-center">${goalDiff}</td>
            `;
            standingsTableUserBody.appendChild(tr);
        });
    }

    function getTopBy(list, field) {
        const safeList = Array.isArray(list) ? list : [];
        return safeList.reduce((best, item) => {
            if (!best) return item;
            if (Number(item[field] || 0) > Number(best[field] || 0)) return item;
            if (Number(item[field] || 0) === Number(best[field] || 0) && Number(item.points || 0) > Number(best.points || 0)) return item;
            return best;
        }, null);
    }

    function getBestSingleGame(data, matches) {
        const usersById = new Map((data.users || []).map(user => [user.id, user]));
        const settings = Ranking.getSettings(data);
        let best = null;

        (matches || []).forEach((match) => {
            Object.entries(data.bets || {}).forEach(([userId, userBets]) => {
                const bet = userBets ? userBets[match.id] : null;
                if (!bet) return;
                const result = Ranking.calculateMatchPoints(match, bet, settings);
                if (!result || !result.points) return;
                if (!best || result.points > best.points) {
                    best = {
                        points: result.points,
                        label: result.label,
                        match: `${match.homeTeam} x ${match.awayTeam}`,
                        user: usersById.get(userId)
                    };
                }
            });
        });

        return best;
    }

    function renderDashboard(data, selectedRoundId) {
        if (!dashboardHighlights || !roundHighlights || !generalInsights || typeof Ranking === 'undefined') return;

        const matches = Array.isArray(data.matches) ? data.matches : [];
        const roundMatches = selectedRoundId && selectedRoundId !== 'all'
            ? matches.filter(match => match.roundId === selectedRoundId)
            : matches;
        const generalRanking = Ranking.calculate(data);
        const roundRanking = Ranking.calculateForMatches(data, roundMatches);
        const leader = generalRanking[0];
        const roundBest = roundRanking[0];
        const exactLeader = getTopBy(generalRanking, 'exactHits');
        const nearLeader = getTopBy(generalRanking, 'nearMisses');
        const efficiencyLeader = getTopBy(generalRanking.filter(item => item.betsCount > 0), 'efficiency');
        const bonusLeader = getTopBy(generalRanking, 'bonusHits');
        const bestSingleGame = getBestSingleGame(data, roundMatches);
        const bonusMatch = roundMatches.find(match => match.isBonus);
        const totalRoundBets = roundRanking.reduce((sum, item) => sum + Number(item.betsCount || 0), 0);
        const totalRoundExact = roundRanking.reduce((sum, item) => sum + Number(item.exactHits || 0), 0);

        const card = (title, value, detail, icon, tone = 'primary') => `
            <div class="col-sm-6 col-xl-3">
                <div class="metric-card metric-card--${tone}">
                    <div class="metric-card__icon"><i class="bi ${icon}"></i></div>
                    <div>
                        <div class="metric-card__label">${title}</div>
                        <div class="metric-card__value">${value || '-'}</div>
                        <div class="metric-card__detail">${detail || '&nbsp;'}</div>
                    </div>
                </div>
            </div>
        `;

        dashboardHighlights.innerHTML = [
            card('Líder geral', leader ? Utils.escapeHtml(leader.name) : '-', leader ? `${Ranking.formatPoints(leader.points)} pts` : 'Sem dados', 'bi-trophy', 'blue'),
            card('Melhor da rodada', roundBest ? Utils.escapeHtml(roundBest.name) : '-', roundBest ? `${Ranking.formatPoints(roundBest.points)} pts` : 'Sem dados', 'bi-star', 'cyan'),
            card('Cravador geral', exactLeader ? Utils.escapeHtml(exactLeader.name) : '-', exactLeader ? `${exactLeader.exactHits} exatos` : 'Sem dados', 'bi-bullseye', 'green'),
            card('Rei da trave', nearLeader ? Utils.escapeHtml(nearLeader.name) : '-', nearLeader ? `${nearLeader.nearMisses} na trave` : 'Sem dados', 'bi-signpost-split', 'yellow')
        ].join('');

        roundHighlights.innerHTML = `
            <div class="insight-list">
                <div class="insight-row">
                    <span>Melhor jogador</span>
                    <strong>${roundBest ? `${Utils.escapeHtml(roundBest.name)} (${Ranking.formatPoints(roundBest.points)} pts)` : '-'}</strong>
                </div>
                <div class="insight-row">
                    <span>Maior pontuação em um jogo</span>
                    <strong>${bestSingleGame ? `${Utils.escapeHtml(bestSingleGame.user ? bestSingleGame.user.name : '-')} - ${Ranking.formatPoints(bestSingleGame.points)} pts` : '-'}</strong>
                </div>
                <div class="insight-row">
                    <span>Placares exatos na rodada</span>
                    <strong>${totalRoundExact}</strong>
                </div>
                <div class="insight-row">
                    <span>Apostas registradas</span>
                    <strong>${totalRoundBets}</strong>
                </div>
                <div class="insight-row">
                    <span>Jogo bônus</span>
                    <strong>${bonusMatch ? `${Utils.escapeHtml(bonusMatch.homeTeam)} x ${Utils.escapeHtml(bonusMatch.awayTeam)}` : '-'}</strong>
                </div>
            </div>
        `;

        generalInsights.innerHTML = `
            <div class="insight-list">
                <div class="insight-row">
                    <span>Melhor aproveitamento</span>
                    <strong>${efficiencyLeader ? `${Utils.escapeHtml(efficiencyLeader.name)} (${efficiencyLeader.efficiency.toFixed(2)} pts/aposta)` : '-'}</strong>
                </div>
                <div class="insight-row">
                    <span>Maior pontuação em bônus</span>
                    <strong>${bonusLeader ? `${Utils.escapeHtml(bonusLeader.name)} (${bonusLeader.bonusHits} acertos)` : '-'}</strong>
                </div>
                <div class="insight-row">
                    <span>Participantes ativos</span>
                    <strong>${generalRanking.filter(item => item.betsCount > 0).length}</strong>
                </div>
                <div class="insight-row">
                    <span>Total de apostas</span>
                    <strong>${generalRanking.reduce((sum, item) => sum + Number(item.betsCount || 0), 0)}</strong>
                </div>
            </div>
        `;
    }

    loadRoundsAndMatches();

    function getLatestRoundId(rounds) {
        if (!Array.isArray(rounds) || rounds.length === 0) return null;

        const getRoundNumber = (round) => {
            const name = round && round.name ? String(round.name) : '';
            const match = name.match(/(\d+)/g);
            if (match && match.length > 0) {
                const num = parseInt(match[match.length - 1], 10);
                return Number.isFinite(num) ? num : null;
            }
            if (round && typeof round.number === 'number' && Number.isFinite(round.number)) return round.number;
            return null;
        };

        let bestRound = rounds[0];
        let bestNumber = getRoundNumber(bestRound);

        for (let i = 1; i < rounds.length; i++) {
            const candidate = rounds[i];
            const candidateNumber = getRoundNumber(candidate);

            if (candidateNumber === null) continue;
            if (bestNumber === null || candidateNumber > bestNumber) {
                bestRound = candidate;
                bestNumber = candidateNumber;
            }
        }

        return bestRound ? bestRound.id : null;
    }

    function getRoundNumber(round) {
        const name = round && round.name ? String(round.name) : '';
        const match = name.match(/(\d+)/g);
        if (match && match.length > 0) {
            const num = parseInt(match[match.length - 1], 10);
            return Number.isFinite(num) ? num : null;
        }
        if (round && typeof round.number === 'number' && Number.isFinite(round.number)) return round.number;
        return null;
    }

    function renderPagination(totalItems) {
        if (!paginationContainer) return;

        const totalPages = Math.ceil(totalItems / pageSize);
        paginationContainer.innerHTML = '';

        if (totalPages <= 1) return;

        const addItem = ({ label, page, disabled = false, active = false, ariaLabel = null }) => {
            const li = document.createElement('li');
            li.className = `page-item${disabled ? ' disabled' : ''}${active ? ' active' : ''}`;

            const a = document.createElement('a');
            a.className = 'page-link';
            a.href = '#';
            a.textContent = label;
            if (ariaLabel) a.setAttribute('aria-label', ariaLabel);

            a.addEventListener('click', (e) => {
                e.preventDefault();
                if (disabled || active) return;
                currentPage = page;
                renderMatches(cachedData);
            });

            li.appendChild(a);
            paginationContainer.appendChild(li);
        };

        addItem({
            label: '«',
            page: Math.max(1, currentPage - 1),
            disabled: currentPage === 1,
            ariaLabel: 'Página anterior'
        });

        for (let p = 1; p <= totalPages; p++) {
            addItem({ label: String(p), page: p, active: p === currentPage });
        }

        addItem({
            label: '»',
            page: Math.min(totalPages, currentPage + 1),
            disabled: currentPage === totalPages,
            ariaLabel: 'Próxima página'
        });
    }

    function populateTeamFilter(matches) {
        if (!teamFilter) return;

        const currentSelection = teamFilter.value;
        const teams = new Set();

        (matches || []).forEach(match => {
            if (match.homeTeam) teams.add(String(match.homeTeam).trim());
            if (match.awayTeam) teams.add(String(match.awayTeam).trim());
        });

        const sortedTeams = Array.from(teams).sort((a, b) => a.localeCompare(b, 'pt-BR'));

        teamFilter.innerHTML = '<option value="all">Todos os Times</option>';
        sortedTeams.forEach(team => {
            const option = document.createElement('option');
            option.value = team;
            option.textContent = team;
            teamFilter.appendChild(option);
        });

        if (currentSelection && Array.from(teamFilter.options).some(option => option.value === currentSelection)) {
            teamFilter.value = currentSelection;
        } else {
            teamFilter.value = 'all';
        }
    }

    // Carregar rodadas no filtro
    async function loadRoundsAndMatches(options = {}) {
        console.log("User.js v2.1 - Carregando dados...");
        try {
            console.log("Iniciando carregamento de rodadas e jogos...");
            const data = await Storage.getData({ forceRefresh: Boolean(options.forceRefresh) });
            console.log("Dados recebidos do Storage:", data);
            
            const rounds = data.rounds || [];
            cachedData = data;
            populateTeamFilter(data.matches || []);

            if (rounds.length === 0) {
                console.warn("Nenhuma rodada encontrada.");
                // Adicionar uma opção de aviso
                roundFilter.innerHTML = '<option value="">Nenhuma rodada cadastrada</option>';
            } else {
                // Salva a seleção atual para não perder se o usuário já escolheu algo
                const currentSelection = roundFilter.value;

                roundFilter.innerHTML = '<option value="all">Todas as Rodadas</option>';
                const roundsSorted = [...rounds].sort((a, b) => {
                    const na = getRoundNumber(a);
                    const nb = getRoundNumber(b);
                    if (na !== null && nb !== null) return na - nb;
                    if (na !== null) return -1;
                    if (nb !== null) return 1;
                    return String(a.name || '').localeCompare(String(b.name || ''));
                });

                roundsSorted.forEach(r => {
                    const opt = document.createElement('option');
                    opt.value = r.id;
                    opt.textContent = r.name;
                    roundFilter.appendChild(opt);
                });

                // Restaura seleção se possível
                if (currentSelection && Array.from(roundFilter.options).some(o => o.value === currentSelection)) {
                    roundFilter.value = currentSelection;
                } else {
                    const latestRoundId = getLatestRoundId(roundsSorted);
                    roundFilter.value = latestRoundId || 'all';
                }
            }

            // Carregar jogos inicialmente usando os dados já baixados
            currentPage = 1;
            renderMatches(data);
        } catch (error) {
            console.error("Erro crítico em loadRoundsAndMatches:", error);
            alert("Erro ao carregar dados do servidor. Detalhes no console.");
        }
    }

    roundFilter.addEventListener('change', () => {
        currentPage = 1;
        renderMatches(cachedData);
    });

    if (teamFilter) {
        teamFilter.addEventListener('change', () => {
            currentPage = 1;
            renderMatches(cachedData);
        });
    }

    async function renderMatches(providedData = null) {
        try {
            console.log("Renderizando jogos...");
            const data = providedData || await Storage.getData();
            const selectedRoundId = roundFilter.value;
            const selectedTeam = teamFilter ? teamFilter.value : 'all';
            const currentUser = Storage.getCurrentUser();

            if (typeof Ranking !== 'undefined') {
                try {
                    await Ranking.render('homeRankingTableBody', data);
                    await Ranking.render('rankingTableBody', data);
                    await Ranking.renderRound('rankingRoundTableBody', selectedRoundId, data);
                    renderDashboard(data, selectedRoundId);
                } catch (rankingError) {
                    console.error("Erro ao renderizar ranking:", rankingError);
                }
            }

            try {
                renderStandings(data.standings || []);
            } catch (standingsError) {
                console.error("Erro ao renderizar classificação:", standingsError);
            }
            
            // Verificação de segurança se dados vieram vazios
            if (!data || !data.matches) {
                 matchesContainer.innerHTML = '<div class="alert alert-warning">Não foi possível carregar os jogos. Tente recarregar a página.</div>';
                 return;
            }

            let matches = [...data.matches]; // Copia para não alterar o original
            console.log(`Total de jogos brutos: ${matches.length}`);
            console.log(`Filtro de rodada atual: "${selectedRoundId}"`);

            if (selectedRoundId && selectedRoundId !== 'all' && selectedRoundId !== '') {
                matches = matches.filter(m => m.roundId === selectedRoundId);
                console.log(`Jogos após filtro de rodada: ${matches.length}`);
            }

            if (selectedTeam && selectedTeam !== 'all') {
                matches = matches.filter(match => match.homeTeam === selectedTeam || match.awayTeam === selectedTeam);
                console.log(`Jogos após filtro de time: ${matches.length}`);
            }

            // Ordenar: Jogos abertos primeiro, depois por data
            matches.sort((a, b) => {
                const dateA = new Date(a.date + 'T' + a.time);
                const dateB = new Date(b.date + 'T' + b.time);
                
                if (isNaN(dateA.getTime())) return 1;
                if (isNaN(dateB.getTime())) return -1;

                return dateA - dateB;
            });

            cachedData = data;
            matchesContainer.innerHTML = '';
            if (paginationContainer) paginationContainer.innerHTML = '';

            if (matches.length === 0) {
                console.log("Nenhum jogo para exibir na UI após filtros.");
                
                // Mensagem diferenciada dependendo se existem dados brutos ou não
                if (data.matches.length === 0) {
                     matchesContainer.innerHTML = `
                        <div class="alert alert-warning text-center">
                            <h4><i class="bi bi-exclamation-triangle"></i> Nenhum jogo encontrado no sistema</h4>
                            <p>O banco de dados parece estar vazio.</p>
                            <hr>
                            <p class="mb-0">Se você é o Admin, cadastre rodadas e jogos no painel administrativo.</p>
                        </div>`;
                } else {
                    const filterMessage = selectedTeam && selectedTeam !== 'all'
                        ? 'Nenhum jogo encontrado para os filtros selecionados.'
                        : 'Nenhum jogo encontrado para esta rodada.';
                    matchesContainer.innerHTML = `
                        <div class="alert alert-info text-center">
                            ${filterMessage}
                            <br>
                            <small class="text-muted">Tente mudar o filtro acima.</small>
                        </div>`;
                }
                return;
            }
            
            // ... resto da função renderMatches ...

            let renderedCount = 0;
            const totalPages = Math.max(1, Math.ceil(matches.length / pageSize));
            if (currentPage > totalPages) currentPage = totalPages;
            if (currentPage < 1) currentPage = 1;

            const startIndex = (currentPage - 1) * pageSize;
            const endIndex = startIndex + pageSize;
            const matchesToRender = matches.slice(startIndex, endIndex);

            matchesToRender.forEach(match => {
                try {
                    const round = data.rounds.find(r => r.id === match.roundId);
                    const safeRoundName = Utils.escapeHtml(round ? round.name : '-');
                    const safeDateTime = Utils.escapeHtml(Utils.formatDateTime(match.date, match.time));
                    const isLocked = Utils.isMatchLocked(match.date, match.time) || match.result !== null;
                    const isFinished = match.result !== null;
                    const homeTeamDisplay = typeof Teams !== 'undefined'
                        ? Teams.getTeamMarkup(match.homeTeam, { size: 'lg', layout: 'stacked' })
                        : match.homeTeam;
                    const awayTeamDisplay = typeof Teams !== 'undefined'
                        ? Teams.getTeamMarkup(match.awayTeam, { size: 'lg', layout: 'stacked' })
                        : match.awayTeam;
                    
                    // Buscar aposta do usuário
                    let userBet = null;
                    // Correção: Estrutura é bets[userId][matchId]
                    if (data.bets && data.bets[currentUser.id] && data.bets[currentUser.id][match.id]) {
                        userBet = data.bets[currentUser.id][match.id];
                    }

                    // Determinar status e cor
                    let statusBadge = '';
                    let cardClass = '';
                    
                    if (isFinished) {
                        statusBadge = '<span class="badge bg-secondary">Finalizado</span>';
                        cardClass = 'bg-light border-secondary';
                    } else if (isLocked) {
                        statusBadge = '<span class="badge bg-warning text-dark">Apostas Encerradas</span>';
                        cardClass = 'border-warning';
                    } else {
                        statusBadge = '<span class="badge bg-success">Aberto para Apostas</span>';
                        cardClass = 'border-primary';
                    }

                    // Resultado oficial se houver
                    let resultDisplay = '';
                    if (isFinished) {
                        const hasScore = match.score
                            && Number.isFinite(Number(match.score.home))
                            && Number.isFinite(Number(match.score.away));
                        const finalScoreText = hasScore ? `${Number(match.score.home)} x ${Number(match.score.away)}` : 'Finalizado';
                        const scoreResult = typeof Ranking !== 'undefined'
                            ? Ranking.calculateMatchPoints(match, userBet, Ranking.getSettings(data))
                            : null;

                        if (userBet) {
                            if (scoreResult && scoreResult.isHit) {
                                resultDisplay = `
                                    <div class="alert alert-success mt-3 mb-0 text-center">
                                        <i class="bi bi-trophy-fill"></i> <strong>${Utils.escapeHtml(scoreResult.label)}</strong><br>
                                        Você ganhou <strong>${Ranking.formatPoints(scoreResult.points)}</strong> pontos nesta aposta.
                                    </div>
                                `;
                            } else {
                                resultDisplay = `
                                    <div class="alert alert-danger mt-3 mb-0 text-center">
                                        <strong>Errou!</strong><br>
                                        O placar foi <strong>${finalScoreText}</strong>.
                                    </div>
                                `;
                            }
                        } else {
                            resultDisplay = `
                                <div class="alert alert-secondary mt-3 mb-0 text-center">
                                    Resultado: <strong>${finalScoreText}</strong><br>
                                    <small>Você não apostou neste jogo.</small>
                                </div>
                            `;
                        }
                    }

                    const betScoreHome = userBet && userBet.scoreHome !== null && userBet.scoreHome !== undefined ? Number(userBet.scoreHome) : '';
                    const betScoreAway = userBet && userBet.scoreAway !== null && userBet.scoreAway !== undefined ? Number(userBet.scoreAway) : '';
                    const userBetText = betScoreHome !== '' && betScoreAway !== '' ? `${betScoreHome} x ${betScoreAway}` : '';
                    const bonusBadge = match.isBonus ? '<span class="badge bg-warning text-dark">Bônus 2x</span>' : '';

                    const card = document.createElement('div');
                    card.className = `col-md-6 mb-4`;
                    card.innerHTML = `
                        <div class="card h-100 match-card ${match.isBonus ? 'match-card--bonus' : ''} ${cardClass}">
                            <div class="card-header d-flex justify-content-between align-items-center">
                                <small class="text-muted">${safeRoundName} | ${safeDateTime}</small>
                                <div class="d-flex align-items-center gap-2">
                                    ${match.isBonus ? bonusBadge : ''}
                                    ${statusBadge}
                                </div>
                            </div>
                            <div class="card-body text-center">
                                <div class="match-teams mb-4">
                                    ${homeTeamDisplay}
                                    <div class="match-center-info">
                                        <span class="match-score-display">
                                            ${match.score && Number.isFinite(Number(match.score.home)) && Number.isFinite(Number(match.score.away))
                                                ? `${Number(match.score.home)} x ${Number(match.score.away)}`
                                                : 'x'}
                                        </span>
                                    </div>
                                    ${awayTeamDisplay}
                                </div>
                                
                                ${!isLocked ? `
                                    <hr>
                                    <p class="mb-2">Seu Palpite:</p>
                                    <div class="row g-2 align-items-end justify-content-center">
                                        <div class="col-4">
                                            <label class="form-label small mb-1">${Utils.escapeHtml(match.homeTeam)}</label>
                                            <input type="number" min="0" step="1" class="form-control text-center" id="bet_score_home_${match.id}" value="${betScoreHome}">
                                        </div>
                                        <div class="col-auto pb-2 fw-bold">X</div>
                                        <div class="col-4">
                                            <label class="form-label small mb-1">${Utils.escapeHtml(match.awayTeam)}</label>
                                            <input type="number" min="0" step="1" class="form-control text-center" id="bet_score_away_${match.id}" value="${betScoreAway}">
                                        </div>
                                        <div class="col-12">
                                            <button type="button" class="btn btn-primary w-100" onclick="placeScoreBet('${match.id}')">Salvar Palpite</button>
                                            <div class="bet-feedback alert alert-success d-none mt-2 mb-0 py-2" id="bet_feedback_${match.id}" role="status"></div>
                                        </div>
                                    </div>
                                ` : `
                                    <hr>
                                    ${userBetText ? `
                                        <div class="alert alert-primary mb-0">
                                            Seu palpite: <strong>${userBetText}</strong>
                                        </div>
                                    ` : `
                                        <div class="alert alert-warning mb-0">
                                            Você não apostou neste jogo.
                                        </div>
                                    `}
                                `}

                                ${resultDisplay}
                            </div>
                        </div>
                    `;
                    matchesContainer.appendChild(card);
                    renderedCount++;
                } catch (errMatch) {
                    console.error("Erro ao renderizar jogo:", match, errMatch);
                    // Mostrar erro visualmente
                    const errDiv = document.createElement('div');
                    errDiv.className = 'col-12 mb-3';
                    errDiv.innerHTML = `<div class="alert alert-danger">Erro ao exibir jogo: ${Utils.escapeHtml(errMatch.message)}</div>`;
                    matchesContainer.appendChild(errDiv);
                }
            });

            if (renderedCount === 0 && matches.length > 0) {
                 matchesContainer.innerHTML = '<div class="alert alert-danger">Erro crítico: Jogos existem mas não puderam ser exibidos. Verifique o console.</div>';
            }

            renderPagination(matches.length);
        } catch (error) {
            console.error("Erro crítico em renderMatches:", error);
            if (matchesContainer) {
                matchesContainer.innerHTML = `
                    <div class="alert alert-danger text-center">
                        Erro ao exibir os jogos: ${Utils.escapeHtml(error.message || String(error))}
                    </div>
                `;
            }
        }
    }

    function showBetFeedback(matchId, type, message) {
        const feedback = document.getElementById(`bet_feedback_${matchId}`);
        if (!feedback) {
            alert(message);
            return;
        }

        feedback.className = `bet-feedback alert alert-${type} mt-2 mb-0 py-2`;
        feedback.textContent = message;

        if (feedback.hideTimer) clearTimeout(feedback.hideTimer);
        if (type === 'success') {
            feedback.hideTimer = setTimeout(() => {
                feedback.classList.add('d-none');
            }, 5000);
        }
    }

    window.placeScoreBet = async (matchId) => {
        const data = await Storage.getData();
        const match = data.matches.find(m => m.id === matchId);
        
        if (Utils.isMatchLocked(match.date, match.time) || match.result !== null) {
            alert('Apostas encerradas para este jogo.');
            location.reload();
            return;
        }

        const currentUser = Storage.getCurrentUser();
        const homeInput = document.getElementById(`bet_score_home_${matchId}`);
        const awayInput = document.getElementById(`bet_score_away_${matchId}`);
        const scoreHome = parseInt(homeInput ? homeInput.value : '', 10);
        const scoreAway = parseInt(awayInput ? awayInput.value : '', 10);

        if (!Number.isInteger(scoreHome) || scoreHome < 0 || !Number.isInteger(scoreAway) || scoreAway < 0) {
            showBetFeedback(matchId, 'warning', 'Informe um placar válido com números inteiros maiores ou iguais a zero.');
            return;
        }
        
        const betValue = {
            scoreHome,
            scoreAway,
            createdAt: new Date().toISOString()
        };

        const success = await Storage.saveBet(currentUser.id, matchId, betValue);
        
        if (success) {
            showBetFeedback(matchId, 'success', `Palpite salvo com sucesso: ${scoreHome} x ${scoreAway}.`);
        } else {
            showBetFeedback(matchId, 'danger', 'Erro ao salvar aposta. Tente novamente.');
        }
    };

    // Alterar Senha
    const changePasswordForm = document.getElementById('changePasswordForm');
    if (changePasswordForm) {
        changePasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const currentPass = document.getElementById('currentPassword').value;
            const newPass = document.getElementById('newPassword').value;

            if (!currentPass || !newPass) return;

            const success = typeof Storage.updateUserPasswordWithCurrent === 'function'
                ? await Storage.updateUserPasswordWithCurrent(currentPass, newPass)
                : await Storage.updateUserPassword(currentUser.id, newPass);

            if (success) {
                alert('Senha alterada com sucesso!');
                document.getElementById('changePasswordForm').reset();
                const modal = bootstrap.Modal.getInstance(document.getElementById('changePasswordModal'));
                modal.hide();
            } else {
                alert('Senha atual incorreta ou erro ao alterar senha.');
            }
        });
    }
});

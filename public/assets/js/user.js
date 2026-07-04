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
    const paginationContainer = document.getElementById('matchesPagination');
    const standingsTableUserBody = document.getElementById('standingsTableUserBody');
    const pageSize = 5;
    let currentPage = 1;
    let cachedData = null;

    if (btnRefresh) {
        btnRefresh.addEventListener('click', () => {
            loadRoundsAndMatches();
            // Feedback visual
            const icon = btnRefresh.querySelector('i');
            icon.classList.add('spin-animation'); // Adicionar CSS para girar
            setTimeout(() => icon.classList.remove('spin-animation'), 1000);
        });
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
    async function loadRoundsAndMatches() {
        console.log("User.js v2.1 - Carregando dados...");
        try {
            console.log("Iniciando carregamento de rodadas e jogos...");
            const data = await Storage.getData();
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
                    await Ranking.render('rankingTableBody', data);
                    await Ranking.renderRound('rankingRoundTableBody', selectedRoundId, data);
                } catch (rankingError) {
                    console.error("Erro ao renderizar ranking:", rankingError);
                }
            }

            try {
                renderStandings(data.standings || []);
            } catch (standingsError) {
                console.error("Erro ao renderizar classificacao:", standingsError);
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
                    let userPick = null;
                    // Correção: Estrutura é bets[userId][matchId]
                    if (data.bets && data.bets[currentUser.id] && data.bets[currentUser.id][match.id]) {
                        userPick = data.bets[currentUser.id][match.id].pick;
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
                        const resultMap = { 'home': 'Casa', 'draw': 'Empate', 'away': 'Visitante' };
                        const hasScore = match.score
                            && Number.isFinite(Number(match.score.home))
                            && Number.isFinite(Number(match.score.away));
                        
                        // Comparação robusta (igual ao Ranking)
                        const safePick = userPick ? String(userPick).trim() : null;
                        const safeResult = match.result ? String(match.result).trim() : null;
                        const hit = safePick === safeResult;
                        
                        // Odds seguras
                        const resultOdd = (match.odds && match.odds[match.result]) ? match.odds[match.result] : 0;

                        if (userPick) {
                            if (hit) {
                                const pointsWon = Number(resultOdd).toFixed(2);
                                resultDisplay = `
                                    <div class="alert alert-success mt-3 mb-0 text-center">
                                        <i class="bi bi-trophy-fill"></i> <strong>ACERTOU!</strong><br>
                                        Você ganhou <strong>${pointsWon}</strong> pontos nesta aposta.
                                    </div>
                                `;
                            } else {
                                resultDisplay = `
                                    <div class="alert alert-danger mt-3 mb-0 text-center">
                                        <strong>Errou!</strong><br>
                                        O resultado foi <strong>${resultMap[match.result]}</strong>.
                                    </div>
                                `;
                            }
                        } else {
                            resultDisplay = `
                                <div class="alert alert-secondary mt-3 mb-0 text-center">
                                    Resultado: <strong>${resultMap[match.result]}</strong><br>
                                    <small>Você não apostou neste jogo.</small>
                                </div>
                            `;
                        }
                    }

                    const card = document.createElement('div');
                    card.className = `col-md-6 mb-4`;
                    card.innerHTML = `
                        <div class="card h-100 ${cardClass}">
                            <div class="card-header d-flex justify-content-between align-items-center">
                                <small class="text-muted">${safeRoundName} | ${safeDateTime}</small>
                                ${statusBadge}
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
                                
                                <div class="mb-3">
                                    <small class="text-muted d-block mb-1">Odds (Cotações)</small>
                                    <span class="badge bg-light text-dark border me-1">Casa: ${Utils.formatDecimal(match.odds.home)}</span>
                                    <span class="badge bg-light text-dark border me-1">Empate: ${Utils.formatDecimal(match.odds.draw)}</span>
                                    <span class="badge bg-light text-dark border">Fora: ${Utils.formatDecimal(match.odds.away)}</span>
                                </div>

                                ${!isLocked ? `
                                    <hr>
                                    <p class="mb-2">Sua Aposta:</p>
                                    <div class="btn-group w-100" role="group">
                                        <input type="radio" class="btn-check" name="bet_${match.id}" id="bet_home_${match.id}" autocomplete="off" ${userPick === 'home' ? 'checked' : ''} onchange="placeBet('${match.id}', 'home')">
                                        <label class="btn btn-outline-primary" for="bet_home_${match.id}">Casa</label>

                                        <input type="radio" class="btn-check" name="bet_${match.id}" id="bet_draw_${match.id}" autocomplete="off" ${userPick === 'draw' ? 'checked' : ''} onchange="placeBet('${match.id}', 'draw')">
                                        <label class="btn btn-outline-secondary" for="bet_draw_${match.id}">Empate</label>

                                        <input type="radio" class="btn-check" name="bet_${match.id}" id="bet_away_${match.id}" autocomplete="off" ${userPick === 'away' ? 'checked' : ''} onchange="placeBet('${match.id}', 'away')">
                                        <label class="btn btn-outline-danger" for="bet_away_${match.id}">Fora</label>
                                    </div>
                                ` : `
                                    <hr>
                                    ${userPick ? `
                                        <div class="alert alert-primary mb-0">
                                            Sua aposta: <strong>${userPick === 'home' ? 'Casa' : (userPick === 'draw' ? 'Empate' : 'Fora')}</strong>
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

    window.placeBet = async (matchId, pick) => {
        const data = await Storage.getData();
        const match = data.matches.find(m => m.id === matchId);
        
        // Validação de tempo novamente
        if (Utils.isMatchLocked(match.date, match.time) || match.result !== null) {
            alert('Apostas encerradas para este jogo.');
            location.reload(); // Recarregar para atualizar status visual
            return;
        }

        const currentUser = Storage.getCurrentUser();
        
        const betValue = {
            pick: pick,
            createdAt: new Date().toISOString()
        };

        const success = await Storage.saveBet(currentUser.id, matchId, betValue);
        
        if (success) {
            renderMatches();
        } else {
            alert('Erro ao salvar aposta.');
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

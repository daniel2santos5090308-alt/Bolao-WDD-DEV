/**
 * Lógica do Painel Administrativo
 */

document.addEventListener('DOMContentLoaded', () => {
    Auth.requireAdmin();

    const currentUser = Storage.getCurrentUser();
    if (currentUser) {
        document.getElementById('userNameDisplay').textContent = currentUser.name;
    }

    document.getElementById('btnLogout').addEventListener('click', (e) => {
        e.preventDefault();
        Auth.logout();
    });

    const roundsList = document.getElementById('roundsList');
    const matchesList = document.getElementById('matchesList');
    const standingsTableBody = document.getElementById('standingsTableBody');
    const roundSelect = document.getElementById('matchRound');
    const filterRound = document.getElementById('filterRound');
    const randomBonusButton = document.getElementById('randomBonusButton');

    const roundForm = document.getElementById('roundForm');
    const matchForm = document.getElementById('matchForm');
    const standingForm = document.getElementById('standingForm');
    const scoringSettingsForm = document.getElementById('scoringSettingsForm');
    const editingMatchIdInput = document.getElementById('editingMatchId');
    const editingStandingIdInput = document.getElementById('editingStandingId');
    const matchFormTitle = document.getElementById('matchFormTitle');
    const standingFormTitle = document.getElementById('standingFormTitle');
    const matchSubmitButton = document.getElementById('matchSubmitButton');
    const standingSubmitButton = document.getElementById('standingSubmitButton');
    const cancelEditMatchButton = document.getElementById('cancelEditMatch');
    const cancelEditStandingButton = document.getElementById('cancelEditStanding');
    const standingCsvInput = document.getElementById('standingCsvInput');
    const standingCsvSampleButton = document.getElementById('standingCsvSampleButton');
    const previewStandingsCsvButton = document.getElementById('previewStandingsCsvButton');
    const saveStandingsCsvButton = document.getElementById('saveStandingsCsvButton');
    const standingCsvStatus = document.getElementById('standingCsvStatus');
    const standingCsvPreviewWrapper = document.getElementById('standingCsvPreviewWrapper');
    const standingCsvPreviewBody = document.getElementById('standingCsvPreviewBody');

    const resultMap = { home: 'Casa', draw: 'Empate', away: 'Visitante' };
    let parsedStandingsCsvRows = [];

    loadRounds();
    loadMatches();
    loadStandings();
    loadScoringSettings();
    loadAdminRankings();

    function getRoundNumber(round) {
        if (round && typeof round.number === 'number' && Number.isFinite(round.number)) return round.number;
        const name = round && round.name ? String(round.name) : '';
        const match = name.match(/(\d+)/g);
        if (!match || match.length === 0) return null;
        const num = parseInt(match[match.length - 1], 10);
        return Number.isFinite(num) ? num : null;
    }

    function getLatestRoundId(list) {
        if (!Array.isArray(list) || list.length === 0) return null;

        let best = list[0];
        let bestNumber = getRoundNumber(best);

        for (let i = 1; i < list.length; i++) {
            const candidate = list[i];
            const candidateNumber = getRoundNumber(candidate);
            if (candidateNumber === null) continue;
            if (bestNumber === null || candidateNumber > bestNumber) {
                best = candidate;
                bestNumber = candidateNumber;
            }
        }

        return best ? best.id : null;
    }

    function getMatchResultFromScore(homeScore, awayScore) {
        if (homeScore > awayScore) return 'home';
        if (homeScore < awayScore) return 'away';
        return 'draw';
    }

    function getGoalDifference(goalsFor, goalsAgainst) {
        return goalsFor - goalsAgainst;
    }

    function normalizeStandingTeamName(team) {
        return String(team || '').trim().toLocaleLowerCase('pt-BR');
    }

    function detectCsvDelimiter(line) {
        const delimiters = [';', ',', '\t'];
        return delimiters
            .map(delimiter => ({ delimiter, count: line.split(delimiter).length }))
            .sort((a, b) => b.count - a.count)[0].delimiter;
    }

    function parseCsvLine(line, delimiter) {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const next = line[i + 1];

            if (char === '"' && inQuotes && next === '"') {
                current += '"';
                i++;
                continue;
            }

            if (char === '"') {
                inQuotes = !inQuotes;
                continue;
            }

            if (char === delimiter && !inQuotes) {
                result.push(current.trim());
                current = '';
                continue;
            }

            current += char;
        }

        result.push(current.trim());
        return result;
    }

    function parseIntegerField(value, label, lineNumber) {
        const normalized = String(value || '').trim();
        const number = parseInt(normalized, 10);
        if (!Number.isInteger(number) || number < 0 || String(number) !== normalized) {
            throw new Error(`Linha ${lineNumber}: ${label} deve ser um número inteiro maior ou igual a zero.`);
        }
        return number;
    }

    function parseStandingsCsv(csvText) {
        const lines = String(csvText || '')
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(Boolean);

        if (lines.length < 2) {
            throw new Error('Informe o cabeçalho e pelo menos uma linha de classificação.');
        }

        const delimiter = detectCsvDelimiter(lines[0]);
        const headers = parseCsvLine(lines[0], delimiter).map(header => header.trim().toLowerCase());
        const requiredHeaders = [
            'position',
            'team',
            'points',
            'played',
            'wins',
            'draws',
            'losses',
            'goals_for',
            'goals_against',
            'goal_diff'
        ];

        const missing = requiredHeaders.filter(header => !headers.includes(header));
        if (missing.length > 0) {
            throw new Error(`Cabeçalho incompleto. Campos ausentes: ${missing.join(', ')}.`);
        }

        const headerIndex = Object.fromEntries(headers.map((header, index) => [header, index]));
        const seenPositions = new Set();
        const seenTeams = new Set();

        return lines.slice(1).map((line, index) => {
            const lineNumber = index + 2;
            const fields = parseCsvLine(line, delimiter);
            const team = String(fields[headerIndex.team] || '').trim();

            if (!team) {
                throw new Error(`Linha ${lineNumber}: time é obrigatório.`);
            }

            const standing = {
                position: parseIntegerField(fields[headerIndex.position], 'position', lineNumber),
                team,
                points: parseIntegerField(fields[headerIndex.points], 'points', lineNumber),
                played: parseIntegerField(fields[headerIndex.played], 'played', lineNumber),
                wins: parseIntegerField(fields[headerIndex.wins], 'wins', lineNumber),
                draws: parseIntegerField(fields[headerIndex.draws], 'draws', lineNumber),
                losses: parseIntegerField(fields[headerIndex.losses], 'losses', lineNumber),
                goalsFor: parseIntegerField(fields[headerIndex.goals_for], 'goals_for', lineNumber),
                goalsAgainst: parseIntegerField(fields[headerIndex.goals_against], 'goals_against', lineNumber),
                goalDiff: parseInt(fields[headerIndex.goal_diff], 10)
            };

            if (!Number.isInteger(standing.goalDiff)) {
                throw new Error(`Linha ${lineNumber}: goal_diff deve ser um número inteiro.`);
            }

            if (seenPositions.has(standing.position)) {
                throw new Error(`Linha ${lineNumber}: posição duplicada (${standing.position}).`);
            }

            const normalizedTeam = normalizeStandingTeamName(team);
            if (seenTeams.has(normalizedTeam)) {
                throw new Error(`Linha ${lineNumber}: time duplicado (${team}).`);
            }

            seenPositions.add(standing.position);
            seenTeams.add(normalizedTeam);
            return standing;
        }).sort((a, b) => a.position - b.position);
    }

    function renderStandingsCsvPreview(rows) {
        if (!standingCsvPreviewWrapper || !standingCsvPreviewBody) return;

        standingCsvPreviewBody.innerHTML = rows.map(row => `
            <tr class="${getStandingZone(row.position)}">
                <td>${row.position}</td>
                <td>${Utils.escapeHtml(row.team)}</td>
                <td class="text-center">${row.points}</td>
                <td class="text-center">${row.played}</td>
                <td class="text-center">${row.wins}</td>
                <td class="text-center">${row.draws}</td>
                <td class="text-center">${row.losses}</td>
                <td class="text-center">${row.goalsFor}</td>
                <td class="text-center">${row.goalsAgainst}</td>
                <td class="text-center">${row.goalDiff}</td>
            </tr>
        `).join('');

        standingCsvPreviewWrapper.classList.remove('d-none');
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

    function hasSelectOption(select, value) {
        return value && Array.from(select.options).some(option => option.value === value);
    }

    function getRandomIndex(max) {
        if (max <= 1) return 0;

        if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
            const values = new Uint32Array(1);
            window.crypto.getRandomValues(values);
            return values[0] % max;
        }

        return Math.floor(Math.random() * max);
    }

    async function setRoundBonusMatch(data, roundId, bonusMatchId) {
        const roundMatches = data.matches.filter(item => item.roundId === roundId);
        let success = true;

        for (const match of roundMatches) {
            const nextIsBonus = Boolean(bonusMatchId && match.id === bonusMatchId);
            if (Boolean(match.isBonus) !== nextIsBonus) {
                const updated = await Storage.updateMatch({ ...match, isBonus: nextIsBonus });
                success = success && updated;
            }
        }

        return success;
    }

    function setMatchFormMode(isEditing) {
        matchFormTitle.textContent = isEditing ? 'Editar Jogo' : 'Novo Jogo';
        matchSubmitButton.textContent = isEditing ? 'Salvar Alterações' : 'Cadastrar Jogo';
        cancelEditMatchButton.classList.toggle('d-none', !isEditing);
    }

    function setStandingFormMode(isEditing) {
        standingFormTitle.textContent = isEditing ? 'Editar Classificação Brasileirão 2026' : 'Classificação Brasileirão 2026';
        standingSubmitButton.textContent = isEditing ? 'Salvar Alterações' : 'Salvar Classificação';
        cancelEditStandingButton.classList.toggle('d-none', !isEditing);
    }

    function resetMatchForm(options = {}) {
        const keepSelectedRound = options.keepSelectedRound !== false;
        const selectedRound = keepSelectedRound ? roundSelect.value : '';

        matchForm.reset();
        editingMatchIdInput.value = '';
        setMatchFormMode(false);

        if (selectedRound && hasSelectOption(roundSelect, selectedRound)) {
            roundSelect.value = selectedRound;
        }
    }

    function updateGoalDiffPreview() {
        const goalsFor = parseInt(document.getElementById('standingGoalsFor').value, 10);
        const goalsAgainst = parseInt(document.getElementById('standingGoalsAgainst').value, 10);
        const goalDiffInput = document.getElementById('standingGoalDiff');

        if (!Number.isInteger(goalsFor) || !Number.isInteger(goalsAgainst)) {
            goalDiffInput.value = '';
            return;
        }

        goalDiffInput.value = String(getGoalDifference(goalsFor, goalsAgainst));
    }

    function resetStandingForm() {
        standingForm.reset();
        editingStandingIdInput.value = '';
        setStandingFormMode(false);
        updateGoalDiffPreview();
    }

    function startEditingMatch(match) {
        editingMatchIdInput.value = match.id;
        document.getElementById('matchRound').value = match.roundId || '';
        document.getElementById('matchDate').value = match.date || '';
        document.getElementById('matchTime').value = match.time || '';
        document.getElementById('homeTeam').value = match.homeTeam || '';
        document.getElementById('awayTeam').value = match.awayTeam || '';
        setMatchFormMode(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function startEditingStanding(standing) {
        editingStandingIdInput.value = standing.id;
        document.getElementById('standingPosition').value = standing.position ?? '';
        document.getElementById('standingTeam').value = standing.team || '';
        document.getElementById('standingPoints').value = standing.points ?? '';
        document.getElementById('standingPlayed').value = standing.played ?? '';
        document.getElementById('standingWins').value = standing.wins ?? '';
        document.getElementById('standingDraws').value = standing.draws ?? '';
        document.getElementById('standingLosses').value = standing.losses ?? '';
        document.getElementById('standingGoalsFor').value = standing.goalsFor ?? '';
        document.getElementById('standingGoalsAgainst').value = standing.goalsAgainst ?? '';
        updateGoalDiffPreview();
        setStandingFormMode(true);
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }

    cancelEditMatchButton.addEventListener('click', () => {
        resetMatchForm({ keepSelectedRound: false });
    });

    cancelEditStandingButton.addEventListener('click', () => {
        resetStandingForm();
    });

    ['standingGoalsFor', 'standingGoalsAgainst'].forEach((id) => {
        document.getElementById(id).addEventListener('input', updateGoalDiffPreview);
    });

    roundForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const roundName = document.getElementById('roundName').value.trim();
        if (!roundName) return;

        const data = await Storage.getData();
        const newRound = {
            id: Utils.generateId(),
            name: roundName,
            number: data.rounds.length + 1
        };

        const success = await Storage.addRound(newRound);

        if (success) {
            roundForm.reset();
            loadRounds();
            Utils.showAlert('Rodada criada com sucesso!');
        } else {
            alert('Erro ao criar rodada.');
        }
    });

    async function loadRounds() {
        const data = await Storage.getData();
        const rounds = Array.isArray(data.rounds) ? [...data.rounds] : [];
        const currentFilterSelection = filterRound.value;
        const currentFormSelection = roundSelect.value;

        rounds.sort((a, b) => {
            const na = getRoundNumber(a);
            const nb = getRoundNumber(b);
            if (na !== null && nb !== null) return na - nb;
            if (na !== null) return -1;
            if (nb !== null) return 1;
            return String(a.name || '').localeCompare(String(b.name || ''));
        });

        roundsList.innerHTML = '';
        roundSelect.innerHTML = '<option value="">Selecione a rodada</option>';
        filterRound.innerHTML = '<option value="all">Todas as Rodadas</option>';

        rounds.forEach((round) => {
            const li = document.createElement('li');
            li.className = 'list-group-item d-flex justify-content-between align-items-center';
            li.textContent = round.name;

            const btnDelete = document.createElement('button');
            btnDelete.className = 'btn btn-sm btn-danger';
            btnDelete.innerHTML = '&times;';
            btnDelete.onclick = () => window.deleteRound(round.id);
            li.appendChild(btnDelete);

            roundsList.appendChild(li);

            const option = document.createElement('option');
            option.value = round.id;
            option.textContent = round.name;
            roundSelect.appendChild(option.cloneNode(true));
            filterRound.appendChild(option);
        });

        const latestRoundId = getLatestRoundId(rounds);

        if (hasSelectOption(filterRound, currentFilterSelection) && currentFilterSelection !== 'all') {
            filterRound.value = currentFilterSelection;
        } else if (latestRoundId) {
            filterRound.value = latestRoundId;
        } else {
            filterRound.value = 'all';
        }

        if (hasSelectOption(roundSelect, currentFormSelection)) {
            roundSelect.value = currentFormSelection;
        }

        loadMatches();
        loadAdminRankings(data);
    }

    async function loadAdminRankings(providedData = null) {
        if (typeof Ranking === 'undefined') return;

        try {
            const data = providedData || await Storage.getData();
            await Ranking.render('adminRankingTableBody', data);
            await Ranking.renderRound('adminRankingRoundTableBody', filterRound.value, data);
        } catch (error) {
            console.error('Erro ao carregar ranking no admin:', error);
        }
    }

    window.deleteRound = async (id) => {
        if (!confirm('Tem certeza? Isso apagará também os jogos desta rodada.')) return;

        const data = await Storage.getData();
        const matchesToDelete = data.matches.filter(match => match.roundId === id);

        for (const match of matchesToDelete) {
            await Storage.deleteMatch(match.id);
        }

        await Storage.deleteRound(id);

        loadRounds();
        loadMatches();
        loadAdminRankings();
    };

    matchForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const editingMatchId = editingMatchIdInput.value;
        const roundId = document.getElementById('matchRound').value;
        const date = document.getElementById('matchDate').value;
        const time = document.getElementById('matchTime').value;
        const homeTeam = document.getElementById('homeTeam').value.trim();
        const awayTeam = document.getElementById('awayTeam').value.trim();
        if (!roundId) {
            alert('Selecione uma rodada.');
            return;
        }

        const data = await Storage.getData();
        const existingMatch = editingMatchId ? data.matches.find(match => match.id === editingMatchId) : null;

        if (editingMatchId && !existingMatch) {
            alert('O jogo que estava em edição não foi encontrado.');
            resetMatchForm({ keepSelectedRound: false });
            loadMatches();
            loadAdminRankings();
            return;
        }

        const matchPayload = {
            ...(existingMatch || {}),
            id: editingMatchId || Utils.generateId(),
            roundId,
            date,
            time,
            homeTeam,
            awayTeam,
            odds: {
                home: 1,
                draw: 1,
                away: 1
            },
            isBonus: existingMatch ? Boolean(existingMatch.isBonus) : false,
            result: existingMatch ? (existingMatch.result ?? null) : null,
            score: existingMatch ? (existingMatch.score ?? null) : null
        };

        const success = editingMatchId
            ? await Storage.updateMatch(matchPayload)
            : await Storage.addMatch(matchPayload);

        if (success) {
            resetMatchForm();
            if (hasSelectOption(roundSelect, roundId)) {
                roundSelect.value = roundId;
            }
            loadMatches();
            loadAdminRankings();
            Utils.showAlert(editingMatchId ? 'Jogo atualizado com sucesso!' : 'Jogo cadastrado!');
        } else {
            alert(editingMatchId ? 'Erro ao atualizar jogo.' : 'Erro ao cadastrar jogo.');
        }
    });

    async function loadScoringSettings() {
        if (!scoringSettingsForm) return;

        const data = await Storage.getData();
        const settings = data.scoringSettings || Storage.getDefaultScoringSettings();

        document.getElementById('exactScorePoints').value = settings.exactScorePoints;
        document.getElementById('nearMissPoints').value = settings.nearMissPoints;
        document.getElementById('wrongPoints').value = settings.wrongPoints;
        document.getElementById('bonusMultiplier').value = settings.bonusMultiplier;
        document.getElementById('bonusEnabled').checked = Boolean(settings.bonusEnabled);
    }

    if (scoringSettingsForm) {
        scoringSettingsForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const settings = {
                id: 'default',
                exactScorePoints: Number(document.getElementById('exactScorePoints').value),
                nearMissPoints: Number(document.getElementById('nearMissPoints').value),
                wrongPoints: Number(document.getElementById('wrongPoints').value),
                bonusMultiplier: Number(document.getElementById('bonusMultiplier').value),
                bonusEnabled: document.getElementById('bonusEnabled').checked
            };

            const values = [
                settings.exactScorePoints,
                settings.nearMissPoints,
                settings.wrongPoints,
                settings.bonusMultiplier
            ];

            if (values.some(value => !Number.isFinite(value) || value < 0) || settings.bonusMultiplier < 1) {
                alert('Preencha a pontuação com valores válidos.');
                return;
            }

            const success = await Storage.updateScoringSettings(settings);
            if (success) {
                Utils.showAlert('Pontuação atualizada com sucesso!');
                loadMatches();
                loadAdminRankings();
            } else {
                alert('Erro ao salvar a pontuação.');
            }
        });
    }

    standingForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const editingStandingId = editingStandingIdInput.value;
        const position = parseInt(document.getElementById('standingPosition').value, 10);
        const team = document.getElementById('standingTeam').value.trim();
        const points = parseInt(document.getElementById('standingPoints').value, 10);
        const played = parseInt(document.getElementById('standingPlayed').value, 10);
        const wins = parseInt(document.getElementById('standingWins').value, 10);
        const draws = parseInt(document.getElementById('standingDraws').value, 10);
        const losses = parseInt(document.getElementById('standingLosses').value, 10);
        const goalsFor = parseInt(document.getElementById('standingGoalsFor').value, 10);
        const goalsAgainst = parseInt(document.getElementById('standingGoalsAgainst').value, 10);

        const numbers = [position, points, played, wins, draws, losses, goalsFor, goalsAgainst];
        if (numbers.some(value => !Number.isInteger(value) || value < 0) || !team) {
            alert('Preencha a classificação com valores válidos.');
            return;
        }

        const standingPayload = {
            id: editingStandingId || Utils.generateId(),
            position,
            team,
            points,
            played,
            wins,
            draws,
            losses,
            goalsFor,
            goalsAgainst,
            goalDiff: getGoalDifference(goalsFor, goalsAgainst)
        };

        const success = editingStandingId
            ? await Storage.updateStanding(standingPayload)
            : await Storage.addStanding(standingPayload);

        if (success) {
            resetStandingForm();
            loadStandings();
            Utils.showAlert(editingStandingId ? 'Classificação atualizada com sucesso!' : 'Classificação cadastrada com sucesso!');
        } else {
            alert(editingStandingId ? 'Erro ao atualizar a classificação.' : 'Erro ao cadastrar a classificação.');
        }
    });

    if (standingCsvSampleButton && standingCsvInput) {
        standingCsvSampleButton.addEventListener('click', () => {
            standingCsvInput.value = [
                'position;team;points;played;wins;draws;losses;goals_for;goals_against;goal_diff',
                '1;Palmeiras;41;18;12;5;1;30;13;17',
                '2;Flamengo;34;17;10;4;3;28;13;15'
            ].join('\n');
            parsedStandingsCsvRows = [];
            if (standingCsvPreviewWrapper) standingCsvPreviewWrapper.classList.add('d-none');
            if (saveStandingsCsvButton) saveStandingsCsvButton.classList.add('d-none');
            if (standingCsvStatus) standingCsvStatus.textContent = 'Modelo inserido. Substitua pelos dados completos antes de salvar.';
        });
    }

    if (previewStandingsCsvButton && standingCsvInput) {
        previewStandingsCsvButton.addEventListener('click', () => {
            try {
                parsedStandingsCsvRows = parseStandingsCsv(standingCsvInput.value);
                renderStandingsCsvPreview(parsedStandingsCsvRows);
                if (saveStandingsCsvButton) saveStandingsCsvButton.classList.remove('d-none');
                if (standingCsvStatus) {
                    standingCsvStatus.textContent = `${parsedStandingsCsvRows.length} linhas validadas. Confira a prévia antes de salvar.`;
                    standingCsvStatus.className = 'small text-muted';
                }
            } catch (error) {
                parsedStandingsCsvRows = [];
                if (standingCsvPreviewWrapper) standingCsvPreviewWrapper.classList.add('d-none');
                if (saveStandingsCsvButton) saveStandingsCsvButton.classList.add('d-none');
                if (standingCsvStatus) {
                    standingCsvStatus.textContent = error.message;
                    standingCsvStatus.className = 'small text-danger';
                }
            }
        });
    }

    if (saveStandingsCsvButton) {
        saveStandingsCsvButton.addEventListener('click', async () => {
            const originalButtonContent = saveStandingsCsvButton.innerHTML;
            const setSavingState = (isSaving) => {
                saveStandingsCsvButton.disabled = isSaving;
                if (previewStandingsCsvButton) previewStandingsCsvButton.disabled = isSaving;
                if (standingCsvSampleButton) standingCsvSampleButton.disabled = isSaving;
                saveStandingsCsvButton.innerHTML = isSaving
                    ? '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Salvando...'
                    : originalButtonContent;
            };

            if (!parsedStandingsCsvRows.length) {
                alert('Pré-visualize um CSV válido antes de salvar.');
                return;
            }

            if (parsedStandingsCsvRows.length < 20 && !confirm(`O CSV possui ${parsedStandingsCsvRows.length} times. Deseja salvar mesmo assim?`)) {
                return;
            }

            if (!confirm('Salvar esta classificação em lote? Times que não estiverem no CSV serão removidos da classificação atual.')) {
                return;
            }

            setSavingState(true);
            if (standingCsvStatus) {
                standingCsvStatus.textContent = 'Salvando classificação em lote...';
                standingCsvStatus.className = 'small text-muted';
            }

            try {
            const data = await Storage.getData({ forceRefresh: true });
            const existingStandings = Array.isArray(data.standings) ? data.standings : [];
            const existingByTeam = new Map(existingStandings.map(item => [normalizeStandingTeamName(item.team), item]));
            const csvTeams = new Set(parsedStandingsCsvRows.map(item => normalizeStandingTeamName(item.team)));

            let success = true;

            for (const row of parsedStandingsCsvRows) {
                const existing = existingByTeam.get(normalizeStandingTeamName(row.team));
                const payload = {
                    id: existing ? existing.id : Utils.generateId(),
                    ...row
                };
                const saved = existing
                    ? await Storage.updateStanding(payload)
                    : await Storage.addStanding(payload);
                success = success && saved;
            }

            for (const standing of existingStandings) {
                if (!csvTeams.has(normalizeStandingTeamName(standing.team))) {
                    const deleted = await Storage.deleteStanding(standing.id);
                    success = success && deleted;
                }
            }

            if (!success) {
                alert('A classificação foi parcialmente atualizada. Recarregue e confira os dados.');
                loadStandings();
                return;
            }

            resetStandingForm();
            loadStandings();
            if (standingCsvStatus) {
                standingCsvStatus.textContent = `Classificação atualizada com ${parsedStandingsCsvRows.length} times.`;
                standingCsvStatus.className = 'small text-success';
            }
            Utils.showAlert('Classificação atualizada em lote com sucesso!');
            } catch (error) {
                console.error('Erro ao salvar classificação via CSV:', error);
                if (standingCsvStatus) {
                    standingCsvStatus.textContent = 'Não foi possível salvar a classificação. Tente novamente.';
                    standingCsvStatus.className = 'small text-danger';
                }
                alert('Não foi possível salvar a classificação. Tente novamente.');
            } finally {
                setSavingState(false);
            }
        });
    }

    filterRound.addEventListener('change', () => {
        loadMatches();
        loadAdminRankings();
    });

    if (randomBonusButton) {
        randomBonusButton.addEventListener('click', async () => {
            const selectedRoundId = filterRound.value;

            if (!selectedRoundId || selectedRoundId === 'all') {
                alert('Selecione uma rodada no filtro antes de sortear o jogo bonus.');
                return;
            }

            const data = await Storage.getData();
            const selectedRound = data.rounds.find(item => item.id === selectedRoundId);
            const roundMatches = data.matches.filter(item => item.roundId === selectedRoundId);

            if (roundMatches.length === 0) {
                alert('Esta rodada ainda nao possui jogos cadastrados.');
                return;
            }

            const currentBonus = roundMatches.find(item => item.isBonus);
            if (currentBonus && !confirm('Esta rodada ja possui um jogo bonus. Deseja sortear novamente e substituir o atual?')) {
                return;
            }

            const selectedMatch = roundMatches[getRandomIndex(roundMatches.length)];
            const success = await setRoundBonusMatch(data, selectedRoundId, selectedMatch.id);

            if (!success) {
                alert('Erro ao sortear o jogo bonus.');
                return;
            }

            loadMatches();
            loadAdminRankings();
            const roundName = selectedRound ? selectedRound.name : 'Rodada';
            Utils.showAlert(`Jogo bonus sorteado para ${roundName}: ${selectedMatch.homeTeam} x ${selectedMatch.awayTeam}.`);
        });
    }

    async function loadMatches() {
        const data = await Storage.getData();
        const selectedRoundId = filterRound.value;

        let matches = Array.isArray(data.matches) ? [...data.matches] : [];
        if (selectedRoundId !== 'all') {
            matches = matches.filter(match => match.roundId === selectedRoundId);
        }

        matches.sort((a, b) => new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`));

        matchesList.innerHTML = '';
        if (matches.length === 0) {
            matchesList.innerHTML = '<div class="alert alert-info">Nenhum jogo cadastrado.</div>';
            return;
        }

        matches.forEach((match) => {
            const round = data.rounds.find(item => item.id === match.roundId);
            const roundName = round ? round.name : 'Rodada desconhecida';
            const safeRoundName = Utils.escapeHtml(roundName);
            const safeHomeTeam = Utils.escapeHtml(match.homeTeam);
            const safeAwayTeam = Utils.escapeHtml(match.awayTeam);
            const isFinished = match.result !== null;
            const hasScore = match.score
                && Number.isFinite(Number(match.score.home))
                && Number.isFinite(Number(match.score.away));
            const homeTeamDisplay = typeof Teams !== 'undefined'
                ? Teams.getTeamMarkup(match.homeTeam, { size: 'md', layout: 'stacked' })
                : match.homeTeam;
            const awayTeamDisplay = typeof Teams !== 'undefined'
                ? Teams.getTeamMarkup(match.awayTeam, { size: 'md', layout: 'stacked' })
                : match.awayTeam;

            const card = document.createElement('div');
            card.className = `card mb-3 match-card ${match.isBonus ? 'match-card--bonus' : ''} ${isFinished ? 'border-secondary bg-light' : ''}`;
            card.innerHTML = `
                <div class="card-header d-flex justify-content-between align-items-center flex-wrap gap-2">
                    <small class="text-muted">${safeRoundName} - ${Utils.escapeHtml(Utils.formatDateTime(match.date, match.time))}</small>
                    <div class="d-flex align-items-center flex-wrap gap-2">
                        <button class="btn btn-sm btn-outline-primary" onclick="editMatch('${match.id}')">Editar</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteMatch('${match.id}')">Excluir</button>
                    </div>
                </div>
                <div class="card-body">
                    <div class="row text-center align-items-center">
                        <div class="col-md-4 mb-2 mb-md-0">${homeTeamDisplay}</div>
                        <div class="col-md-4 mb-2 mb-md-0">
                            <div class="match-score-display">${hasScore ? `${Number(match.score.home)} x ${Number(match.score.away)}` : 'X'}</div>
                            ${match.result ? `<div class="small text-muted mt-1">${resultMap[match.result]}</div>` : ''}
                            <div class="small text-muted">${Utils.escapeHtml(Utils.formatDateTime(match.date, match.time))}</div>
                        </div>
                        <div class="col-md-4">${awayTeamDisplay}</div>
                    </div>

                    <div class="mt-3 text-center">
                        ${match.isBonus ? '<span class="badge bg-warning text-dark">Jogo bônus 2x</span>' : '<span class="badge bg-light text-dark border">Pontuação normal</span>'}
                        <button class="btn btn-sm ${match.isBonus ? 'btn-outline-warning' : 'btn-outline-primary'} ms-2" onclick="toggleBonusMatch('${match.id}')">
                            ${match.isBonus ? 'Remover bônus' : 'Marcar bônus'}
                        </button>
                    </div>

                    <hr>

                    <div class="row g-2 align-items-end justify-content-center">
                        <div class="col-sm-3 col-md-2">
                            <label class="form-label small mb-1">${safeHomeTeam}</label>
                            <input type="number" min="0" step="1" class="form-control text-center" id="score_home_${match.id}" value="${hasScore ? Number(match.score.home) : ''}">
                        </div>
                        <div class="col-sm-auto text-center pb-sm-2">
                            <span class="fw-bold">X</span>
                        </div>
                        <div class="col-sm-3 col-md-2">
                            <label class="form-label small mb-1">${safeAwayTeam}</label>
                            <input type="number" min="0" step="1" class="form-control text-center" id="score_away_${match.id}" value="${hasScore ? Number(match.score.away) : ''}">
                        </div>
                        <div class="col-sm-auto">
                            <button class="btn btn-sm btn-success" onclick="saveMatchScore('${match.id}')">Salvar Placar</button>
                        </div>
                        <div class="col-sm-auto">
                            ${match.result ? `<button class="btn btn-sm btn-outline-warning" onclick="clearResult('${match.id}')">Limpar</button>` : ''}
                        </div>
                    </div>
                    <div class="small text-muted text-center mt-2">
                        O resultado do jogo é calculado automaticamente a partir do placar salvo.
                    </div>
                </div>
            `;
            matchesList.appendChild(card);
        });
    }

    async function loadStandings() {
        const data = await Storage.getData();
        const standings = Array.isArray(data.standings) ? [...data.standings] : [];

        standings.sort((a, b) => {
            if ((a.position ?? 999) !== (b.position ?? 999)) return (a.position ?? 999) - (b.position ?? 999);
            return String(a.team || '').localeCompare(String(b.team || ''), 'pt-BR');
        });

        standingsTableBody.innerHTML = '';
        if (standings.length === 0) {
            standingsTableBody.innerHTML = '<tr><td colspan="11" class="text-center text-muted">Nenhuma classificação cadastrada.</td></tr>';
            return;
        }

        standings.forEach((standing) => {
            const teamDisplay = typeof Teams !== 'undefined'
                ? Teams.getTeamMarkup(standing.team, { size: 'sm', layout: 'row' })
                : standing.team;
            const tr = document.createElement('tr');
            const zoneClass = getStandingZone(standing.position);
            if (zoneClass) tr.classList.add(zoneClass);
            tr.innerHTML = `
                <td>${standing.position ?? '-'}</td>
                <td>${teamDisplay}</td>
                <td class="text-center">${standing.points ?? 0}</td>
                <td class="text-center">${standing.played ?? 0}</td>
                <td class="text-center">${standing.wins ?? 0}</td>
                <td class="text-center">${standing.draws ?? 0}</td>
                <td class="text-center">${standing.losses ?? 0}</td>
                <td class="text-center">${standing.goalsFor ?? 0}</td>
                <td class="text-center">${standing.goalsAgainst ?? 0}</td>
                <td class="text-center">${standing.goalDiff ?? getGoalDifference(Number(standing.goalsFor || 0), Number(standing.goalsAgainst || 0))}</td>
                <td class="text-center">
                    <button class="btn btn-sm btn-outline-primary me-1" onclick="editStanding('${standing.id}')">Editar</button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteStanding('${standing.id}')">Excluir</button>
                </td>
            `;
            standingsTableBody.appendChild(tr);
        });
    }

    window.editMatch = async (id) => {
        const data = await Storage.getData();
        const match = data.matches.find(item => item.id === id);
        if (!match) {
            alert('Jogo não encontrado.');
            return;
        }
        startEditingMatch(match);
    };

    window.deleteMatch = async (id) => {
        if (!confirm('Excluir este jogo?')) return;

        await Storage.deleteMatch(id);

        if (editingMatchIdInput.value === id) {
            resetMatchForm({ keepSelectedRound: false });
        }

        loadMatches();
        loadAdminRankings();
    };

    window.editStanding = async (id) => {
        const data = await Storage.getData();
        const standing = (data.standings || []).find(item => item.id === id);
        if (!standing) {
            alert('Linha da classificação não encontrada.');
            return;
        }
        startEditingStanding(standing);
    };

    window.deleteStanding = async (id) => {
        if (!confirm('Excluir esta linha da classificação?')) return;
        const success = await Storage.deleteStanding(id);
        if (success) {
            if (editingStandingIdInput.value === id) {
                resetStandingForm();
            }
            loadStandings();
        } else {
            alert('Erro ao excluir a classificação.');
        }
    };

    window.toggleBonusMatch = async (matchId) => {
        const data = await Storage.getData();
        const selectedMatch = data.matches.find(item => item.id === matchId);
        if (!selectedMatch) {
            alert('Jogo não encontrado.');
            return;
        }

        const shouldEnable = !selectedMatch.isBonus;
        const success = await setRoundBonusMatch(data, selectedMatch.roundId, shouldEnable ? matchId : null);

        if (!success) {
            alert('Erro ao atualizar o jogo bonus.');
            return;
        }

        loadMatches();
        loadAdminRankings();
        Utils.showAlert(shouldEnable ? 'Jogo bônus definido para a rodada!' : 'Bônus removido da rodada.');
    };

    window.saveMatchScore = async (matchId) => {
        const homeScoreInput = document.getElementById(`score_home_${matchId}`);
        const awayScoreInput = document.getElementById(`score_away_${matchId}`);

        const homeScore = parseInt(homeScoreInput.value, 10);
        const awayScore = parseInt(awayScoreInput.value, 10);

        if (!Number.isInteger(homeScore) || homeScore < 0 || !Number.isInteger(awayScore) || awayScore < 0) {
            alert('Informe um placar válido com números inteiros maiores ou iguais a zero.');
            return;
        }

        const data = await Storage.getData();
        const match = data.matches.find(item => item.id === matchId);
        if (!match) {
            alert('Jogo não encontrado.');
            return;
        }

        match.score = {
            home: homeScore,
            away: awayScore
        };
        match.result = getMatchResultFromScore(homeScore, awayScore);

        const success = await Storage.updateMatch(match);
        if (success) {
            loadMatches();
            loadAdminRankings();
            Utils.showAlert('Placar salvo com sucesso!');
        } else {
            alert('Erro ao salvar o placar.');
        }
    };

    window.clearResult = async (matchId) => {
        if (!confirm('Deseja limpar o resultado e o placar? Isso afetará o ranking.')) return;

        const data = await Storage.getData();
        const match = data.matches.find(item => item.id === matchId);
        if (match) {
            match.result = null;
            match.score = null;
            await Storage.updateMatch(match);
            loadMatches();
            loadAdminRankings();
        }
    };

    document.getElementById('btnExport').addEventListener('click', () => {
        async function exportData() {
            const data = await Storage.getData();
            const blob = new Blob([JSON.stringify(data, null, 4)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `bolao_backup_${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }

        exportData();
    });

    document.getElementById('btnImport').addEventListener('click', () => {
        document.getElementById('fileImport').click();
    });

    document.getElementById('fileImport').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (ev) => {
            try {
                const data = JSON.parse(ev.target.result);
                if (data.users || data.matches) {
                    const success = await Storage.migrateFromJSON(data);
                    if (success) {
                        alert('Dados importados com sucesso! A página será recarregada.');
                        location.reload();
                    } else {
                        alert('Erro ao salvar dados no Firebase.');
                    }
                } else {
                    alert('Formato de arquivo inválido.');
                }
            } catch (err) {
                console.error(err);
                alert('Erro ao ler arquivo JSON.');
            }
        };
        reader.readAsText(file);
    });

    document.getElementById('btnReset').addEventListener('click', async () => {
        if (confirm('ATENÇÃO: Isso apagará TODOS os dados (rodadas, jogos, apostas). Deseja continuar?')) {
            await Storage.resetData();
            location.reload();
        }
    });
});

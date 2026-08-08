import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const { Storage, Ranking, Teams, Utils } = window.BolaoLegacy;

function getRoundNumber(round) {
  const value = Number(round?.number);
  if (Number.isFinite(value)) return value;
  const match = String(round?.name || '').match(/(\d+)/g);
  return match ? Number(match[match.length - 1]) : 0;
}

function getLatestRoundId(rounds) {
  const sorted = [...(rounds || [])].sort((a, b) => getRoundNumber(b) - getRoundNumber(a));
  return sorted[0]?.id || 'all';
}

function formatDateTime(match) {
  return Utils.formatDateTime(match.date, match.time).replace('Ã s', 'às');
}

function isFinished(match) {
  return match.result !== null && match.result !== undefined;
}

function getMatchScore(match) {
  if (!match?.score) return null;
  const home = Number(match.score.home);
  const away = Number(match.score.away);
  return Number.isFinite(home) && Number.isFinite(away) ? `${home} x ${away}` : null;
}

function TeamBadge({ name, size = 'lg' }) {
  const markup = Teams.getTeamMarkup(name, { size, layout: 'stacked' });
  return <span dangerouslySetInnerHTML={{ __html: markup }} />;
}

function useBolaoData() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastLoadedAt, setLastLoadedAt] = useState('');

  async function load(options = {}) {
    setLoading(true);
    setError('');
    try {
      const nextData = await Storage.getData({ forceRefresh: Boolean(options.forceRefresh) });
      setData(nextData);
      setLastLoadedAt(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    } catch (err) {
      console.error('Erro ao carregar dados React:', err);
      setError('Não foi possível carregar os dados. Tente atualizar.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return { data, setData, loading, error, lastLoadedAt, refresh: () => load({ forceRefresh: true }) };
}

function RankingTable({ title, icon, tone, ranking, summary, onDetails }) {
  return (
    <section className={`side-card side-card--${tone}`}>
      <header className="side-card__header">
        <span><i className={`bi ${icon}`} /> {title}</span>
      </header>
      {summary ? <div className="side-card__summary">{summary}</div> : null}
      <div className="ranking-list">
        {ranking.length === 0 ? (
          <div className="empty-state">Sem dados.</div>
        ) : ranking.slice(0, 6).map((item, index) => (
          <button className="ranking-row" type="button" key={item.id} onClick={() => onDetails(item)}>
            <span className={`ranking-row__pos ${index === 0 ? 'is-leader' : ''}`}>{index + 1}</span>
            <span className="ranking-row__name">{item.name}</span>
            <span className="ranking-row__points">{Ranking.formatPoints(item.points)}</span>
            <span className="ranking-row__stats">
              PE {item.exactHits} · NT {item.nearMisses} · B {item.bonusHits}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function MatchCard({ match, roundName, currentUser, data, onSaved }) {
  const [home, setHome] = useState('');
  const [away, setAway] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');
  const userBet = data?.bets?.[currentUser.id]?.[match.id] || null;
  const locked = Utils.isMatchLocked(match.date, match.time) || isFinished(match);
  const score = getMatchScore(match);

  useEffect(() => {
    setHome(userBet?.scoreHome ?? '');
    setAway(userBet?.scoreAway ?? '');
  }, [userBet?.scoreHome, userBet?.scoreAway]);

  async function saveBet() {
    const scoreHome = Number(home);
    const scoreAway = Number(away);
    if (!Number.isInteger(scoreHome) || scoreHome < 0 || !Number.isInteger(scoreAway) || scoreAway < 0) {
      setFeedback('Informe um placar válido.');
      return;
    }

    setSaving(true);
    setFeedback('');
    const success = await Storage.saveBet(currentUser.id, match.id, {
      scoreHome,
      scoreAway,
      createdAt: new Date().toISOString()
    });
    setSaving(false);

    if (success) {
      setFeedback(`Palpite salvo: ${scoreHome} x ${scoreAway}`);
      const nextData = Storage.cloneData(data);
      if (!nextData.bets[currentUser.id]) nextData.bets[currentUser.id] = {};
      nextData.bets[currentUser.id][match.id] = { scoreHome, scoreAway, createdAt: new Date().toISOString() };
      onSaved(nextData);
    } else {
      setFeedback('Erro ao salvar. Tente novamente.');
    }
  }

  const result = isFinished(match) && userBet
    ? Ranking.calculateMatchPoints(match, userBet, Ranking.getSettings(data))
    : null;

  return (
    <article className={`match-tile ${match.isBonus ? 'match-tile--bonus' : ''} ${locked ? 'is-locked' : ''}`}>
      {match.isBonus ? <div className="bonus-ribbon"><i className="bi bi-stars" /> Bônus 2x</div> : null}
      <header className="match-tile__top">
        <span>{roundName}</span>
        <strong>{formatDateTime(match)}</strong>
      </header>
      <div className="scoreboard">
        <TeamBadge name={match.homeTeam} />
        <div className="scoreboard__center">
          <span className="scoreboard__score">{score || 'x'}</span>
          <span className={`status-pill ${locked ? 'status-pill--locked' : 'status-pill--open'}`}>
            {isFinished(match) ? 'Finalizado' : locked ? 'Encerrado' : 'Aberto'}
          </span>
        </div>
        <TeamBadge name={match.awayTeam} />
      </div>
      <div className="bet-box">
        {locked ? (
          <div className="saved-pick">
            {userBet ? `Seu palpite: ${userBet.scoreHome} x ${userBet.scoreAway}` : 'Você não apostou neste jogo.'}
            {result?.isHit ? <strong>{result.label}: +{Ranking.formatPoints(result.points)} pts</strong> : null}
          </div>
        ) : (
          <>
            <div className="bet-box__title">Seu palpite</div>
            <div className="bet-inputs">
              <label>
                <span>{match.homeTeam}</span>
                <input value={home} onChange={(event) => setHome(event.target.value)} type="number" min="0" />
              </label>
              <b>X</b>
              <label>
                <span>{match.awayTeam}</span>
                <input value={away} onChange={(event) => setAway(event.target.value)} type="number" min="0" />
              </label>
            </div>
            <button className="primary-action" type="button" disabled={saving} onClick={saveBet}>
              {saving ? 'Salvando...' : 'Salvar palpite'}
            </button>
            {feedback ? <div className="inline-feedback">{feedback}</div> : null}
          </>
        )}
      </div>
    </article>
  );
}

function DetailsModal({ user, onClose }) {
  if (!user) return null;
  return (
    <div className="modal-layer" role="dialog" aria-modal="true">
      <div className="details-modal">
        <header>
          <h2>{user.name}</h2>
          <button type="button" onClick={onClose}>Fechar</button>
        </header>
        <div className="details-grid">
          <span><strong>{Ranking.formatPoints(user.points)}</strong> pts</span>
          <span><strong>{user.exactHits}</strong> exatos</span>
          <span><strong>{user.nearMisses}</strong> trave</span>
          <span><strong>{user.bonusHits}</strong> bônus</span>
        </div>
        <div className="details-list">
          {(user.history || []).slice(0, 12).map((item, index) => (
            <div className="details-item" key={`${item.match}-${index}`}>
              <span>{item.match}</span>
              <strong>{item.isFinished ? `+${Ranking.formatPoints(item.points)}` : 'Aberto'}</strong>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function App() {
  const currentUser = Storage.getCurrentUser();
  const { data, setData, loading, error, lastLoadedAt, refresh } = useBolaoData();
  const [selectedRoundId, setSelectedRoundId] = useState('all');
  const [selectedTeam, setSelectedTeam] = useState('all');
  const [detailsUser, setDetailsUser] = useState(null);

  useEffect(() => {
    if (!currentUser) {
      localStorage.setItem('bolao_wdd_return_to', 'react.html');
      window.location.href = 'index.html';
    }
  }, [currentUser]);

  useEffect(() => {
    if (data?.rounds?.length && selectedRoundId === 'all') {
      setSelectedRoundId(getLatestRoundId(data.rounds));
    }
  }, [data?.rounds, selectedRoundId]);

  const rounds = useMemo(() => [...(data?.rounds || [])].sort((a, b) => getRoundNumber(a) - getRoundNumber(b)), [data]);
  const teams = useMemo(() => {
    const names = new Set();
    (data?.matches || []).forEach((match) => {
      names.add(match.homeTeam);
      names.add(match.awayTeam);
    });
    return [...names].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [data]);

  const filteredMatches = useMemo(() => {
    return [...(data?.matches || [])]
      .filter((match) => selectedRoundId === 'all' || match.roundId === selectedRoundId)
      .filter((match) => selectedTeam === 'all' || match.homeTeam === selectedTeam || match.awayTeam === selectedTeam)
      .sort((a, b) => new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`));
  }, [data, selectedRoundId, selectedTeam]);

  const generalRanking = useMemo(() => data ? Ranking.calculate(data) : [], [data]);
  const roundRanking = useMemo(() => data ? Ranking.calculateByRound(data, selectedRoundId) : [], [data, selectedRoundId]);
  const selectedRound = rounds.find((round) => round.id === selectedRoundId);

  if (!currentUser) return null;

  return (
    <main className="react-app">
      <nav className="topbar">
        <div>
          <span className="brand-chip">WDD</span>
          <strong>Bolão WDD</strong>
        </div>
        <div className="topbar__right">
          <span>Olá, {currentUser.name}</span>
          <button type="button" onClick={async () => { await Storage.logout(); window.location.href = 'index.html'; }}>Sair</button>
        </div>
      </nav>

      <section className="hero-board">
        <div>
          <span className="eyebrow">Central da rodada</span>
          <h1>{selectedRound?.name || 'Jogos e apostas'}</h1>
          <p>Palpites por placar, ranking em tempo real local e destaque para o jogo bônus sem consultas automáticas constantes.</p>
        </div>
        <div className="hero-actions">
          <button type="button" onClick={refresh} disabled={loading}>
            <i className={`bi bi-arrow-clockwise ${loading ? 'spin' : ''}`} /> Atualizar
          </button>
          {lastLoadedAt ? <span>Atualizado {lastLoadedAt}</span> : null}
        </div>
      </section>

      <section className="filters-card">
        <select value={selectedRoundId} onChange={(event) => setSelectedRoundId(event.target.value)}>
          <option value="all">Todas as rodadas</option>
          {rounds.map((round) => <option key={round.id} value={round.id}>{round.name}</option>)}
        </select>
        <select value={selectedTeam} onChange={(event) => setSelectedTeam(event.target.value)}>
          <option value="all">Todos os times</option>
          {teams.map((team) => <option key={team} value={team}>{team}</option>)}
        </select>
      </section>

      {error ? <div className="error-banner">{error}</div> : null}

      <div className="main-grid">
        <section className="matches-area">
          {loading && !data ? <div className="empty-state">Carregando jogos...</div> : null}
          {!loading && filteredMatches.length === 0 ? <div className="empty-state">Nenhum jogo encontrado para o filtro.</div> : null}
          {filteredMatches.map((match) => {
            const round = rounds.find((item) => item.id === match.roundId);
            return (
              <MatchCard
                key={match.id}
                match={match}
                roundName={round?.name || 'Rodada'}
                currentUser={currentUser}
                data={data}
                onSaved={setData}
              />
            );
          })}
        </section>

        <aside className="side-stack">
          <RankingTable
            title="Ranking da Rodada"
            icon="bi-stars"
            tone="round"
            ranking={roundRanking}
            summary={roundRanking[0] ? `Melhor: ${roundRanking[0].name} (${Ranking.formatPoints(roundRanking[0].points)} pts)` : ''}
            onDetails={setDetailsUser}
          />
          <RankingTable
            title="Ranking Geral"
            icon="bi-trophy"
            tone="general"
            ranking={generalRanking}
            onDetails={setDetailsUser}
          />
        </aside>
      </div>

      <DetailsModal user={detailsUser} onClose={() => setDetailsUser(null)} />
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);

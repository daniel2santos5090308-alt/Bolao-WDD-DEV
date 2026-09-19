import { useState } from 'react';
import type { CoinSettings } from '../hooks/useCoinSettings';
import { useBolaoData } from '../hooks/useBolaoData';
import { useCoinSettings } from '../hooks/useCoinSettings';

const fields: Array<{ key: keyof Omit<CoinSettings, 'seasonKey'>; label: string; help: string }> = [
  { key: 'initialBalance', label: 'Saldo inicial', help: 'Credito unico ao criar a carteira.' },
  { key: 'firstPlaceReward', label: '1o lugar da rodada', help: 'Premio por melhor pontuacao da rodada.' },
  { key: 'secondPlaceReward', label: '2o lugar da rodada', help: 'Premio por segunda melhor pontuacao.' },
  { key: 'thirdPlaceReward', label: '3o lugar da rodada', help: 'Premio por terceira melhor pontuacao.' },
  { key: 'exactScoreReward', label: 'Placar exato', help: 'Recompensa por cravada simples.' },
  { key: 'bonusExactScoreReward', label: 'Placar exato bonus', help: 'Recompensa extra no jogo bonus.' },
  { key: 'fullRoundParticipationReward', label: 'Participacao completa', help: 'Recompensa por palpitar em todos os jogos da rodada.' }
];

interface RewardFieldProps {
  field: (typeof fields)[number];
  value: number;
  onChange(value: number): void;
}

function RewardField({ field, value, onChange }: RewardFieldProps) {
  return (
    <label className="admin-field">
      <span>{field.label}</span>
      <input
        type="number"
        min="0"
        step="1"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <small>{field.help}</small>
    </label>
  );
}

export function AdminPage() {
  const coinSettings = useCoinSettings('2027');
  const bolaoData = useBolaoData();
  const [draft, setDraft] = useState<CoinSettings | null>(null);
  const [selectedRoundId, setSelectedRoundId] = useState('');
  const [processing, setProcessing] = useState(false);
  const [processMessage, setProcessMessage] = useState('');
  const [processError, setProcessError] = useState('');
  const settings = draft || coinSettings.settings;
  const rounds = bolaoData.data?.rounds || [];
  const matches = bolaoData.data?.matches || [];
  const finishedRounds = rounds.filter((round) => {
    const roundMatches = matches.filter((match) => match.roundId === round.id);
    return roundMatches.length > 0 && roundMatches.every((match) => {
      const hasScore = match.score
        && Number.isFinite(Number(match.score.home))
        && Number.isFinite(Number(match.score.away));
      return Boolean(match.result) && hasScore;
    });
  });

  function updateField(key: keyof Omit<CoinSettings, 'seasonKey'>, value: number) {
    setDraft({
      ...settings,
      [key]: Number.isFinite(value) ? Math.max(0, value) : 0
    });
  }

  async function handleSave() {
    await coinSettings.save(settings);
    setDraft(null);
  }

  function handleRefresh() {
    setDraft(null);
    void coinSettings.refresh();
    void bolaoData.refresh();
    setProcessMessage('');
    setProcessError('');
  }

  async function handleProcessRoundRewards() {
    if (!selectedRoundId) {
      setProcessError('Selecione uma rodada finalizada.');
      return;
    }

    setProcessing(true);
    setProcessMessage('');
    setProcessError('');

    try {
      if (typeof supabaseClient === 'undefined') {
        throw new Error('Supabase nao inicializado.');
      }

      const { data, error } = await supabaseClient.rpc('process_round_coin_rewards', {
        p_round_id: selectedRoundId,
        p_season_key: settings.seasonKey
      });

      if (error) throw error;

      const rewards = data || [];
      const totalAmount = rewards.reduce((sum, row) => sum + Number(row.reward_amount || 0), 0);
      setProcessMessage(`Rodada processada: ${rewards.length} lancamentos e ${totalAmount} WDD Coins creditadas.`);
      await bolaoData.refresh();
    } catch (err) {
      console.error('Erro ao processar recompensas da rodada:', err);
      const message = err instanceof Error ? err.message : 'Nao foi possivel processar as recompensas.';
      setProcessError(message);
    } finally {
      setProcessing(false);
    }
  }

  return (
    <section className="admin-page">
      <div className="admin-hero">
        <span className="eyebrow">Administracao</span>
        <h1>Configuracoes WDD Coins</h1>
        <p>Parametrize as recompensas da temporada. Mudancas devem valer para processamentos futuros.</p>
      </div>

      <section className="admin-panel">
        <header>
          <div>
            <h2>Temporada {settings.seasonKey}</h2>
            <p>Valores em WDD Coins. Nao use numeros negativos.</p>
          </div>
          <div className="admin-panel__actions">
            <button type="button" onClick={handleRefresh} disabled={coinSettings.loading || coinSettings.saving}>
              Atualizar
            </button>
            <button type="button" onClick={handleSave} disabled={coinSettings.loading || coinSettings.saving}>
              {coinSettings.saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </header>

        {coinSettings.error ? <div className="error-banner">{coinSettings.error}</div> : null}
        {coinSettings.savedMessage ? <div className="inline-feedback">{coinSettings.savedMessage}</div> : null}

        <div className="admin-fields-grid">
          {fields.map((field) => (
            <RewardField
              key={field.key}
              field={field}
              value={settings[field.key]}
              onChange={(value) => updateField(field.key, value)}
            />
          ))}
        </div>
      </section>

      <section className="admin-panel">
        <header>
          <div>
            <h2>Processar rodada</h2>
            <p>Credita WDD Coins conforme placares, ranking da rodada e participacao completa.</p>
          </div>
          <div className="admin-panel__actions">
            <button type="button" onClick={handleProcessRoundRewards} disabled={processing || !selectedRoundId}>
              {processing ? 'Processando...' : 'Processar recompensas'}
            </button>
          </div>
        </header>

        {processError ? <div className="error-banner">{processError}</div> : null}
        {processMessage ? <div className="inline-feedback">{processMessage}</div> : null}

        <div className="admin-fields-grid admin-fields-grid--compact">
          <label className="admin-field admin-field--wide">
            <span>Rodada finalizada</span>
            <select
              value={selectedRoundId}
              onChange={(event) => {
                setSelectedRoundId(event.target.value);
                setProcessMessage('');
                setProcessError('');
              }}
              disabled={bolaoData.loading || processing}
            >
              <option value="">Selecione a rodada</option>
              {finishedRounds.map((round) => (
                <option key={round.id} value={round.id}>{round.name}</option>
              ))}
            </select>
            <small>Somente rodadas com todos os jogos finalizados aparecem aqui.</small>
          </label>
        </div>
      </section>
    </section>
  );
}

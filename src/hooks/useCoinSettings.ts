import { useCallback, useEffect, useState } from 'react';

export interface CoinSettings {
  seasonKey: string;
  initialBalance: number;
  firstPlaceReward: number;
  secondPlaceReward: number;
  thirdPlaceReward: number;
  exactScoreReward: number;
  bonusExactScoreReward: number;
  fullRoundParticipationReward: number;
}

const defaultSettings: CoinSettings = {
  seasonKey: '2027',
  initialBalance: 0,
  firstPlaceReward: 1000,
  secondPlaceReward: 750,
  thirdPlaceReward: 500,
  exactScoreReward: 50,
  bonusExactScoreReward: 100,
  fullRoundParticipationReward: 200
};

function readNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function mapSettings(row: Record<string, unknown> | null): CoinSettings {
  if (!row) return defaultSettings;

  return {
    seasonKey: String(row.season_key || defaultSettings.seasonKey),
    initialBalance: readNumber(row.initial_balance, defaultSettings.initialBalance),
    firstPlaceReward: readNumber(row.first_place_reward, defaultSettings.firstPlaceReward),
    secondPlaceReward: readNumber(row.second_place_reward, defaultSettings.secondPlaceReward),
    thirdPlaceReward: readNumber(row.third_place_reward, defaultSettings.thirdPlaceReward),
    exactScoreReward: readNumber(row.exact_score_reward, defaultSettings.exactScoreReward),
    bonusExactScoreReward: readNumber(row.bonus_exact_score_reward, defaultSettings.bonusExactScoreReward),
    fullRoundParticipationReward: readNumber(row.full_round_participation_reward, defaultSettings.fullRoundParticipationReward)
  };
}

function toRow(settings: CoinSettings): Record<string, unknown> {
  return {
    season_key: settings.seasonKey,
    initial_balance: settings.initialBalance,
    first_place_reward: settings.firstPlaceReward,
    second_place_reward: settings.secondPlaceReward,
    third_place_reward: settings.thirdPlaceReward,
    exact_score_reward: settings.exactScoreReward,
    bonus_exact_score_reward: settings.bonusExactScoreReward,
    full_round_participation_reward: settings.fullRoundParticipationReward,
    updated_at: new Date().toISOString()
  };
}

export function useCoinSettings(seasonKey = '2027') {
  const [settings, setSettings] = useState<CoinSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedMessage, setSavedMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      if (typeof supabaseClient === 'undefined') {
        throw new Error('Supabase nao inicializado.');
      }

      const { data, error: queryError } = await supabaseClient
        .from('coin_settings')
        .select('*')
        .eq('season_key', seasonKey)
        .maybeSingle();

      if (queryError) throw queryError;

      setSettings(mapSettings(data));
    } catch (err) {
      console.error('Erro ao carregar configuracoes WDD Coins:', err);
      setError('Nao foi possivel carregar as configuracoes.');
    } finally {
      setLoading(false);
    }
  }, [seasonKey]);

  const save = useCallback(async (nextSettings: CoinSettings) => {
    setSaving(true);
    setError('');
    setSavedMessage('');

    try {
      if (typeof supabaseClient === 'undefined') {
        throw new Error('Supabase nao inicializado.');
      }

      const values = Object.values(nextSettings).filter((value) => typeof value === 'number');
      if (values.some((value) => Number(value) < 0)) {
        throw new Error('Os valores nao podem ser negativos.');
      }

      const { error: saveError } = await supabaseClient
        .from('coin_settings')
        .upsert(toRow(nextSettings));

      if (saveError) throw saveError;

      setSettings(nextSettings);
      setSavedMessage('Configuracoes salvas.');
    } catch (err) {
      console.error('Erro ao salvar configuracoes WDD Coins:', err);
      setError(err instanceof Error ? err.message : 'Nao foi possivel salvar as configuracoes.');
    } finally {
      setSaving(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    settings,
    setSettings,
    loading,
    saving,
    error,
    savedMessage,
    refresh: load,
    save
  };
}

import { useState, type ChangeEvent } from 'react';
import { getRoundNumber } from '../services/matches';
import {
  parseScheduleCsv,
  planScheduleImport,
  SCHEDULE_CSV_SAMPLE,
  type SchedulePlan
} from '../services/scheduleImport';
import { formatIsoDate } from '../services/seasons';
import * as storage from '../services/storage';
import { generateId } from '../services/utils';

interface ScheduleImportProps {
  seasonName: string;
  rounds: BolaoRound[];
  matches: BolaoMatch[];
  onNotify(text: string): void;
  onFail(text: string): void;
  onImported(): Promise<void>;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * Aba "Importar jogos" (Fase 6): a tabela da CBF entra por CSV, com previa.
 * Reimportar o mesmo CSV com datas novas remarca os jogos sem mexer em
 * resultados nem apagar nada.
 */
export function ScheduleImport({ seasonName, rounds, matches, onNotify, onFail, onImported }: ScheduleImportProps) {
  const [csvText, setCsvText] = useState('');
  const [plan, setPlan] = useState<SchedulePlan | null>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  function resetPreview() {
    setPlan(null);
    setParseErrors([]);
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setCsvText(await file.text());
    resetPreview();
  }

  function preview() {
    const parsed = parseScheduleCsv(csvText);
    setParseErrors(parsed.errors);
    if (parsed.errors.length) {
      setPlan(null);
      return;
    }
    setPlan(planScheduleImport(parsed.rows, rounds, matches));
  }

  const blocked = Boolean(plan && plan.errors.length);
  const nothingToDo = Boolean(plan && !plan.newRounds.length && !plan.creates.length && !plan.updates.length);

  async function save() {
    if (!plan || blocked || nothingToDo) return;
    const unknown = plan.unknownTeams.length
      ? ` Times fora da lista oficial (ficam sem escudo): ${plan.unknownTeams.join(', ')}.`
      : '';
    const ok = window.confirm(
      `Importar em ${seasonName}: ${plural(plan.newRounds.length, 'rodada nova', 'rodadas novas')}, ` +
      `${plural(plan.creates.length, 'jogo novo', 'jogos novos')} e ${plural(plan.updates.length, 'remarcação', 'remarcações')}?${unknown}`
    );
    if (!ok) return;

    setSaving(true);
    try {
      const roundIdByNumber = new Map(rounds.map((round) => [getRoundNumber(round), round.id]));
      const newRounds: BolaoRound[] = plan.newRounds.map((round) => {
        const id = generateId();
        roundIdByNumber.set(round.number, id);
        return { id, name: round.name, number: round.number };
      });
      const created: BolaoMatch[] = plan.creates.map((row) => ({
        id: generateId(),
        roundId: roundIdByNumber.get(row.roundNumber) as string,
        date: row.date,
        time: row.time,
        homeTeam: row.homeTeam,
        awayTeam: row.awayTeam,
        isBonus: false,
        result: null,
        score: null
      }));

      const result = await storage.importSchedule(newRounds, [...created, ...plan.updates.map((update) => update.match)]);
      if (!result.ok) {
        onFail(result.step === 'rodadas'
          ? 'Não foi possível criar as rodadas. Nada foi importado.'
          : 'As rodadas foram criadas, mas os jogos não. Corrija e importe de novo: o que já existe não é duplicado.');
        return;
      }
      onNotify(`Importação concluída: ${plural(newRounds.length, 'rodada nova', 'rodadas novas')}, ${plural(created.length, 'jogo novo', 'jogos novos')}, ${plural(plan.updates.length, 'remarcação', 'remarcações')}.`);
      setCsvText('');
      resetPreview();
      await onImported();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-stack">
      <section className="admin-panel">
        <header>
          <div>
            <h2>Importar jogos</h2>
            <p>
              Cole a tabela da CBF no formato <code>rodada;data;hora;mandante;visitante</code>. Os jogos entram em {seasonName}.
              Reimportar com datas novas remarca os jogos; resultados não mudam e nada é apagado.
            </p>
          </div>
          <div className="admin-panel__actions">
            <button type="button" onClick={() => { setCsvText(SCHEDULE_CSV_SAMPLE); resetPreview(); }}>Usar modelo</button>
            <label className="file-button">
              <input type="file" accept=".csv,text/csv,text/plain" onChange={handleFile} />
              Carregar arquivo
            </label>
          </div>
        </header>
        <div className="csv-editor">
          <textarea
            value={csvText}
            onChange={(event) => { setCsvText(event.target.value); resetPreview(); }}
            placeholder={'rodada;data;hora;mandante;visitante\n1;27/01/2027;19:00;Flamengo;Palmeiras'}
            aria-label="CSV da tabela de jogos"
          />
          <div className="admin-panel__actions">
            <button type="button" onClick={preview} disabled={!csvText.trim()}>Pré-visualizar</button>
            <button type="button" onClick={save} disabled={!plan || blocked || nothingToDo || saving}>
              {saving ? 'Importando…' : 'Importar'}
            </button>
          </div>
        </div>

        {parseErrors.length ? (
          <div className="banner banner--error import-list" role="alert">
            <strong>Corrija o CSV antes de importar:</strong>
            <ul>{parseErrors.map((text) => <li key={text}>{text}</li>)}</ul>
          </div>
        ) : null}

        {plan ? (
          <div className="import-preview" aria-label="Prévia da importação">
            <div className="import-summary">
              <span><strong>{plan.newRounds.length}</strong> {plan.newRounds.length === 1 ? 'rodada nova' : 'rodadas novas'}</span>
              <span><strong>{plan.creates.length}</strong> {plan.creates.length === 1 ? 'jogo novo' : 'jogos novos'}</span>
              <span><strong>{plan.updates.length}</strong> {plan.updates.length === 1 ? 'remarcação' : 'remarcações'}</span>
              <span><strong>{plan.unchanged}</strong> sem mudança</span>
            </div>

            {plan.errors.length ? (
              <div className="banner banner--error import-list" role="alert">
                <strong>Corrija o CSV antes de importar:</strong>
                <ul>{plan.errors.map((text) => <li key={text}>{text}</li>)}</ul>
              </div>
            ) : null}

            {nothingToDo && !blocked ? <p className="muted-text">Tudo já está cadastrado como no CSV.</p> : null}

            {plan.unknownTeams.length ? (
              <div className="banner banner--warn import-list">
                <strong>Times fora da lista oficial</strong> (entram com o nome do CSV e ficam sem escudo; confira a grafia):
                <ul>{plan.unknownTeams.map((team) => <li key={team}>{team}</li>)}</ul>
              </div>
            ) : null}

            {plan.warnings.length ? (
              <div className="banner banner--warn import-list">
                <strong>Avisos</strong> (não impedem a importação):
                <ul>{plan.warnings.map((text) => <li key={text}>{text}</li>)}</ul>
              </div>
            ) : null}

            {plan.updates.length ? (
              <div className="import-list">
                <strong>Remarcações</strong>
                <ul>
                  {plan.updates.map(({ match, from }) => (
                    <li key={match.id}>
                      {match.homeTeam} x {match.awayTeam}: {formatIsoDate(from.date)} {from.time} → {formatIsoDate(match.date)} {match.time}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}

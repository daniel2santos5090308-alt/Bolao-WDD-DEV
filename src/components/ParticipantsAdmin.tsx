import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import {
  createParticipant,
  generateTemporaryPassword,
  listParticipants,
  prepareWallets,
  resetParticipantPassword,
  setParticipantActive,
  sortParticipants,
  suggestUsername,
  validatePassword,
  validateUsername,
  type ParticipantInfo
} from '../services/participants';

interface ParticipantsAdminProps {
  seasonKey: string;
  onNotify(text: string): void;
  onFail(text: string): void;
  /** Recarrega os dados do app (o participante novo aparece no ranking e nas listas). */
  onChanged(): Promise<void>;
}

/**
 * Aba "Participantes" (Fase 7): criar login, redefinir senha e desativar,
 * sem entrar no painel do Supabase.
 */
export function ParticipantsAdmin({ seasonKey, onNotify, onFail, onChanged }: ParticipantsAdminProps) {
  const [participants, setParticipants] = useState<ParticipantInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [usernameTouched, setUsernameTouched] = useState(false);
  const [password, setPassword] = useState(() => generateTemporaryPassword());
  const [resetFor, setResetFor] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  // O Admin recria onFail a cada render; a ref evita recarregar a lista sem parar.
  const failRef = useRef(onFail);
  failRef.current = onFail;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setParticipants(await listParticipants());
    } catch (err) {
      failRef.current(err instanceof Error ? err.message : 'Não foi possível carregar os participantes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function handleName(value: string) {
    setName(value);
    if (!usernameTouched) setUsername(suggestUsername(value));
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return onFail('Informe o nome do participante.');
    const problem = validateUsername(username, participants) || validatePassword(password);
    if (problem) return onFail(problem);

    setBusy(true);
    try {
      const created = await createParticipant({ username, name, password });
      setParticipants((current) => sortParticipants([...current, created]));
      onNotify(`${created.name} criado. Passe para ele: usuário "${created.username}" e senha "${password}". A senha pode ser trocada depois em Perfil.`);
      setName('');
      setUsername('');
      setUsernameTouched(false);
      setPassword(generateTemporaryPassword());
      try {
        await prepareWallets(seasonKey);
      } catch (err) {
        onFail(err instanceof Error ? err.message : 'A carteira de WDD Coins não foi preparada.');
      }
      await onChanged();
    } catch (err) {
      onFail(err instanceof Error ? err.message : 'Não foi possível criar o participante.');
    } finally {
      setBusy(false);
    }
  }

  function openReset(participant: ParticipantInfo) {
    setResetFor(participant.id);
    setResetPassword(generateTemporaryPassword());
  }

  async function handleReset(event: FormEvent, participant: ParticipantInfo) {
    event.preventDefault();
    const problem = validatePassword(resetPassword);
    if (problem) return onFail(problem);

    setBusy(true);
    try {
      await resetParticipantPassword(participant.id, resetPassword);
      onNotify(`Nova senha de ${participant.name}: "${resetPassword}". Passe para ele; a senha antiga deixou de valer.`);
      setResetFor(null);
    } catch (err) {
      onFail(err instanceof Error ? err.message : 'Não foi possível trocar a senha.');
    } finally {
      setBusy(false);
    }
  }

  async function handleToggle(participant: ParticipantInfo) {
    const nextActive = !participant.active;
    const question = nextActive
      ? `Reativar ${participant.name}? Ele volta a entrar com o mesmo usuário e senha.`
      : `Desativar ${participant.name}? O login fica bloqueado. Palpites, ranking e WDD Coins dele continuam no histórico.`;
    if (!window.confirm(question)) return;

    setBusy(true);
    try {
      await setParticipantActive(participant.id, nextActive);
      setParticipants((current) => sortParticipants(current.map((item) => (item.id === participant.id ? { ...item, active: nextActive } : item))));
      onNotify(nextActive ? `${participant.name} reativado.` : `${participant.name} desativado.`);
      await onChanged();
    } catch (err) {
      onFail(err instanceof Error ? err.message : 'Não foi possível alterar o participante.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-two-col">
      <section className="admin-panel">
        <header>
          <div>
            <h2>Participantes</h2>
            <p>Quem entra no bolão. Desativar bloqueia o login sem apagar o histórico.</p>
          </div>
        </header>
        <div className="admin-list" aria-busy={loading}>
          {loading ? <div className="admin-list-row"><span>Carregando…</span></div> : null}
          {participants.map((participant) => {
            const isAdmin = participant.role === 'admin';
            return (
              <div key={participant.id} className={`admin-list-row participant-row${participant.active ? '' : ' is-inactive'}`}>
                <div className="participant-row__info">
                  <strong>{participant.name}</strong>
                  <span>@{participant.username}</span>
                </div>
                {isAdmin ? (
                  <span className="chip chip--locked">Admin</span>
                ) : (
                  <div className="participant-row__actions">
                    {participant.active ? null : <span className="chip chip--locked">Desativado</span>}
                    {participant.active ? (
                      <button type="button" onClick={() => openReset(participant)} disabled={busy}>Nova senha</button>
                    ) : null}
                    <button type="button" onClick={() => handleToggle(participant)} disabled={busy}>
                      {participant.active ? 'Desativar' : 'Reativar'}
                    </button>
                  </div>
                )}
                {resetFor === participant.id ? (
                  <form className="admin-inline-form participant-row__reset" onSubmit={(event) => handleReset(event, participant)}>
                    <input
                      value={resetPassword}
                      onChange={(event) => setResetPassword(event.target.value)}
                      aria-label={`Nova senha de ${participant.name}`}
                      autoComplete="off"
                      spellCheck={false}
                    />
                    <button type="submit" disabled={busy}>Salvar senha</button>
                    <button type="button" onClick={() => setResetFor(null)}>Cancelar</button>
                  </form>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      <section className="admin-panel">
        <header>
          <div>
            <h2>Novo participante</h2>
            <p>Cria o login com uma senha provisória. Passe usuário e senha para ele; dá para trocar a senha depois em Perfil.</p>
          </div>
        </header>
        <form className="admin-fields-grid admin-fields-grid--profile" onSubmit={handleCreate}>
          <label className="admin-field">
            <span>Nome</span>
            <input value={name} onChange={(event) => handleName(event.target.value)} placeholder="Ana Paula" required />
          </label>
          <label className="admin-field">
            <span>Usuário</span>
            <input
              value={username}
              onChange={(event) => { setUsername(event.target.value.toLowerCase()); setUsernameTouched(true); }}
              placeholder="ana.paula"
              autoCapitalize="none"
              spellCheck={false}
              required
            />
            <small>É o que ele digita para entrar.</small>
          </label>
          <label className="admin-field">
            <span>Senha provisória</span>
            <input value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="off" spellCheck={false} required />
          </label>
          <div className="admin-panel__actions">
            <button type="button" onClick={() => setPassword(generateTemporaryPassword())}>Gerar outra senha</button>
            <button type="submit" disabled={busy}>Criar participante</button>
          </div>
        </form>
      </section>
    </div>
  );
}

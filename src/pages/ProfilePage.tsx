import { useState } from 'react';
import type { FormEvent } from 'react';
import { updatePasswordWithCurrent } from '../services/auth';

interface ProfilePageProps {
  currentUser: BolaoUser;
}

export function ProfilePage({ currentUser }: ProfilePageProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function handlePasswordChange(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    setError('');

    if (newPassword.length < 6) {
      setError('A nova senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('A confirmação da senha não confere.');
      return;
    }

    setSaving(true);
    try {
      const success = await updatePasswordWithCurrent(currentPassword, newPassword);
      if (!success) throw new Error('Senha atual inválida ou falha ao salvar.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setMessage('Senha atualizada com sucesso.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível atualizar a senha.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="page-stack">
      <div className="section-hero">
        <div>
          <span className="eyebrow">Perfil</span>
          <h1>{currentUser.name}</h1>
          <p>Gerencie seus dados de acesso e acompanhe sua identidade no Bolão WDD.</p>
        </div>
      </div>

      <div className="profile-grid">
        <section className="admin-panel">
          <header>
            <div>
              <h2>Dados do participante</h2>
              <p>Informações carregadas do perfil Supabase.</p>
            </div>
          </header>
          <div className="info-list">
            <span>Nome <strong>{currentUser.name}</strong></span>
            <span>Perfil <strong>{currentUser.role === 'admin' ? 'Administrador' : 'Participante'}</strong></span>
          </div>
        </section>

        <section className="admin-panel">
          <header>
            <div>
              <h2>Alterar senha</h2>
              <p>Use sua senha atual para definir uma nova senha.</p>
            </div>
          </header>
          {message ? <div className="inline-feedback">{message}</div> : null}
          {error ? <div className="error-banner">{error}</div> : null}
          <form className="admin-fields-grid admin-fields-grid--profile" onSubmit={handlePasswordChange}>
            <label className="admin-field">
              <span>Senha atual</span>
              <input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
            </label>
            <label className="admin-field">
              <span>Nova senha</span>
              <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required />
            </label>
            <label className="admin-field">
              <span>Confirmar senha</span>
              <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
            </label>
            <div className="admin-panel__actions">
              <button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar nova senha'}</button>
            </div>
          </form>
        </section>
      </div>
    </section>
  );
}

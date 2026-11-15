import { useState, type FormEvent } from 'react';
import { login } from '../services/auth';

interface LoginPageProps {
  onLogin(user: BolaoUser): void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const user = await login(username.trim(), password);
      if (!user) {
        setError('Usuário ou senha incorretos.');
        return;
      }
      onLogin(user);
    } catch (err) {
      console.error('Erro no login:', err);
      setError('Não foi possível conectar. Verifique sua internet e tente de novo.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <form id="loginForm" className="login-card" onSubmit={handleSubmit} aria-describedby={error ? 'loginError' : undefined}>
        <div className="login-card__brand">
          <span className="brand__mark" aria-hidden="true">WDD</span>
          <h1>Bolão WDD</h1>
          <p>Entre para dar seus palpites.</p>
        </div>

        <label className="admin-field">
          <span>Usuário</span>
          <input
            id="username"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
          />
        </label>

        <label className="admin-field">
          <span>Senha</span>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>

        {error ? <div id="loginError" className="error-banner" role="alert">{error}</div> : null}

        <button type="submit" className="primary-button" disabled={submitting}>
          {submitting ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </main>
  );
}

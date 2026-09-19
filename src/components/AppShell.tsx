import type { ReactNode } from 'react';
import { appRoutes, type AppRoute } from '../app/routes';
import { getLegacy } from '../services/legacyBolao';

interface AppShellProps {
  children: ReactNode;
  currentUser: BolaoUser;
  activeRoute: AppRoute;
  coinBalance: number;
  coinLoading?: boolean;
  onNavigate(route: AppRoute): void;
}

export function AppShell({ children, currentUser, activeRoute, coinBalance, coinLoading = false, onNavigate }: AppShellProps) {
  const isAdmin = currentUser.role === 'admin';
  const visibleRoutes = appRoutes.filter((route) => !route.adminOnly || isAdmin);

  async function handleLogout() {
    await getLegacy().Storage.logout();
    window.location.href = 'index.html';
  }

  return (
    <main className="app-shell">
      <nav className="topbar">
        <div className="topbar__brand">
          <span className="brand-chip">WDD</span>
          <div className="coin-status" aria-label="Saldo WDD Coins">
            <i className="bi bi-coin" aria-hidden="true" />
            <span>WDD Coins</span>
            <strong>{coinLoading ? '...' : coinBalance.toLocaleString('pt-BR')}</strong>
          </div>
        </div>
        <div className="topbar__right">
          <span>Ola, {currentUser.name}</span>
          <button type="button" onClick={handleLogout}>Sair</button>
        </div>
      </nav>
      <nav className="app-nav" aria-label="Navegacao principal">
        {visibleRoutes.map((route) => (
          <button
            className={route.id === activeRoute ? 'is-active' : ''}
            type="button"
            key={route.id}
            onClick={() => onNavigate(route.id)}
          >
            <i className={`bi ${route.icon}`} aria-hidden="true" />
            <span>{route.label}</span>
          </button>
        ))}
      </nav>
      {children}
    </main>
  );
}

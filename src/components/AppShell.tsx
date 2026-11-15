import type { ReactNode } from 'react';
import { appRoutes, type AppRoute } from '../app/routes';

interface AppShellProps {
  children: ReactNode;
  currentUser: BolaoUser;
  activeRoute: AppRoute;
  coinBalance: number;
  coinLoading?: boolean;
  onNavigate(route: AppRoute): void;
  onLogout(): void | Promise<void>;
}

export function AppShell({ children, currentUser, activeRoute, coinBalance, coinLoading = false, onNavigate, onLogout }: AppShellProps) {
  const isAdmin = currentUser.role === 'admin';
  const visibleRoutes = appRoutes.filter((route) => !route.adminOnly || isAdmin);

  return (
    <div className="app-shell">
      <header className="topbar">
        <button type="button" className="brand" onClick={() => onNavigate('jogos')} aria-label="Ir para os jogos">
          <span className="brand__mark">WDD</span>
          <span className="brand__text">
            <strong>Bolão WDD</strong>
            <small>Série A 2027</small>
          </span>
        </button>

        <nav className="topnav" aria-label="Navegação principal">
          {visibleRoutes.map((route) => (
            <button
              key={route.id}
              type="button"
              className={route.id === activeRoute ? 'is-active' : ''}
              aria-current={route.id === activeRoute ? 'page' : undefined}
              onClick={() => onNavigate(route.id)}
            >
              <i className={`bi ${route.icon}`} aria-hidden="true" />
              {route.label}
            </button>
          ))}
        </nav>

        <div className="topbar__right">
          <button type="button" className="coin-pill" onClick={() => onNavigate('coins')} aria-label="Saldo WDD Coins">
            <i className="bi bi-coin" aria-hidden="true" />
            <strong>{coinLoading ? '…' : coinBalance.toLocaleString('pt-BR')}</strong>
          </button>
          <span className="topbar__user">{currentUser.name}</span>
          <button type="button" className="ghost-button" onClick={onLogout}>
            <i className="bi bi-box-arrow-right" aria-hidden="true" />
            <span>Sair</span>
          </button>
        </div>
      </header>

      <main className="app-main">{children}</main>

      <nav className="bottom-nav" aria-label="Navegação principal">
        {visibleRoutes.map((route) => (
          <button
            key={route.id}
            type="button"
            className={route.id === activeRoute ? 'is-active' : ''}
            aria-current={route.id === activeRoute ? 'page' : undefined}
            onClick={() => onNavigate(route.id)}
          >
            <i className={`bi ${route.icon}`} aria-hidden="true" />
            <span>{route.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

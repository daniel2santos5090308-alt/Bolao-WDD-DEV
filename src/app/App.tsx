import { useEffect, useRef, useState } from 'react';
import { AppShell } from '../components/AppShell';
import { appRoutes, parseRouteFromHash, type AppRoute } from './routes';
import { AdminPage } from '../pages/AdminPage';
import { CoinsPage } from '../pages/CoinsPage';
import { DashboardPage } from '../pages/DashboardPage';
import { LoginPage } from '../pages/LoginPage';
import { ProfilePage } from '../pages/ProfilePage';
import { RankingPage } from '../pages/RankingPage';
import { StandingsPage } from '../pages/StandingsPage';
import { useActiveSeason } from '../hooks/useActiveSeason';
import { useCoinWallet } from '../hooks/useCoinWallet';
import { getCurrentUser, hasSupabaseAuthSession, logout } from '../services/auth';
import { confirmDiscardUnsaved } from '../services/unsavedChanges';

export function App() {
  const [currentUser, setCurrentUser] = useState<BolaoUser | null>(() => getCurrentUser());
  const isAdmin = currentUser?.role === 'admin';
  const [activeRoute, setActiveRoute] = useState<AppRoute>(() => parseRouteFromHash(window.location.hash, Boolean(isAdmin)));
  const activeRouteRef = useRef(activeRoute);
  activeRouteRef.current = activeRoute;
  // Admin nao tem carteira: userId vazio = nenhuma consulta.
  const season = useActiveSeason(Boolean(currentUser));
  const seasonKey = season?.key || '';
  const coinWallet = useCoinWallet(isAdmin ? '' : currentUser?.id || '', seasonKey);

  // Perfil salvo, mas a sessao do Supabase expirou: volta para o login.
  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;

    void hasSupabaseAuthSession().then(async (hasSession) => {
      if (hasSession || cancelled) return;
      await logout();
      if (!cancelled) setCurrentUser(null);
    });

    return () => { cancelled = true; };
  }, [currentUser]);

  useEffect(() => {
    function syncRoute() {
      const next = parseRouteFromHash(window.location.hash, Boolean(isAdmin));
      if (next === activeRouteRef.current) return;
      // Botao Voltar do navegador com palpite pendente: desfaz a troca sem disparar outro hashchange.
      if (!confirmDiscardUnsaved()) {
        window.history.pushState(null, '', `#/${activeRouteRef.current}`);
        return;
      }
      setActiveRoute(next);
    }

    window.addEventListener('hashchange', syncRoute);
    syncRoute();
    return () => window.removeEventListener('hashchange', syncRoute);
  }, [isAdmin]);

  function handleLogin(user: BolaoUser) {
    // Admin cai direto no painel, como antes; participante fica na rota pedida (ou Jogos).
    if (user.role === 'admin' && !window.location.hash.replace(/^#\/?/, '')) {
      window.location.hash = '/admin';
    }
    setCurrentUser(user);
  }

  useEffect(() => {
    const label = currentUser ? appRoutes.find((route) => route.id === activeRoute)?.label : 'Entrar';
    document.title = label ? `${label} · Bolão WDD` : 'Bolão WDD';
  }, [currentUser, activeRoute]);

  async function handleLogout() {
    if (!confirmDiscardUnsaved()) return;
    await logout();
    setCurrentUser(null);
  }

  if (!currentUser) return <LoginPage onLogin={handleLogin} />;

  function handleNavigate(route: AppRoute) {
    if (route !== activeRoute && !confirmDiscardUnsaved()) return;
    activeRouteRef.current = route;
    window.location.hash = `/${route}`;
    setActiveRoute(route);
  }

  return (
    <AppShell
      currentUser={currentUser}
      seasonName={season?.name || ''}
      activeRoute={activeRoute}
      coinBalance={coinWallet.availableBalance}
      coinLoading={coinWallet.loading}
      onNavigate={handleNavigate}
      onLogout={handleLogout}
    >
      {activeRoute === 'jogos' ? (
        <DashboardPage currentUser={currentUser} onNavigate={handleNavigate} />
      ) : activeRoute === 'ranking' ? (
        <RankingPage currentUser={currentUser} />
      ) : activeRoute === 'classificacao' ? (
        <StandingsPage />
      ) : activeRoute === 'coins' ? (
        <CoinsPage
          currentUser={currentUser}
          seasonKey={seasonKey}
          availableBalance={coinWallet.availableBalance}
          lockedBalance={coinWallet.lockedBalance}
          walletLoading={coinWallet.loading}
          walletError={coinWallet.error}
          onNavigate={handleNavigate}
          onWalletRefresh={coinWallet.refresh}
        />
      ) : activeRoute === 'perfil' ? (
        <ProfilePage currentUser={currentUser} />
      ) : activeRoute === 'admin' ? (
        <AdminPage />
      ) : (
        <DashboardPage currentUser={currentUser} onNavigate={handleNavigate} />
      )}
    </AppShell>
  );
}

import { useEffect, useState } from 'react';
import { AppShell } from '../components/AppShell';
import { parseRouteFromHash, type AppRoute } from './routes';
import { AdminPage } from '../pages/AdminPage';
import { CoinsPage } from '../pages/CoinsPage';
import { DashboardPage } from '../pages/DashboardPage';
import { LoginPage } from '../pages/LoginPage';
import { ProfilePage } from '../pages/ProfilePage';
import { RankingPage } from '../pages/RankingPage';
import { StandingsPage } from '../pages/StandingsPage';
import { useCoinWallet } from '../hooks/useCoinWallet';
import { getCurrentUser, hasSupabaseAuthSession, logout } from '../services/auth';

export function App() {
  const [currentUser, setCurrentUser] = useState<BolaoUser | null>(() => getCurrentUser());
  const isAdmin = currentUser?.role === 'admin';
  const [activeRoute, setActiveRoute] = useState<AppRoute>(() => parseRouteFromHash(window.location.hash, Boolean(isAdmin)));
  const coinWallet = useCoinWallet(currentUser?.id || '', '2027');

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
      setActiveRoute(parseRouteFromHash(window.location.hash, Boolean(isAdmin)));
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

  async function handleLogout() {
    await logout();
    setCurrentUser(null);
  }

  if (!currentUser) return <LoginPage onLogin={handleLogin} />;

  function handleNavigate(route: AppRoute) {
    window.location.hash = `/${route}`;
    setActiveRoute(route);
  }

  return (
    <AppShell
      currentUser={currentUser}
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

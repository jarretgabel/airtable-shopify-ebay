import { Suspense, lazy } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LoginScreen } from '@/components/LoginScreen';
import { ResetPasswordScreen } from '@/components/ResetPasswordScreen';
import { useAuthSession } from '@/app/useAuthSession';
import { useAppRouteState } from '@/app/useAppRouteState';
import { useAuthRouteGuard } from '@/app/useAuthRouteGuard';

const AuthenticatedAppShell = lazy(async () => ({
  default: (await import('@/app/AuthenticatedAppShell')).AuthenticatedAppShell,
}));

function AuthenticatedAppShellFallback() {
  return (
    <main className="min-h-screen px-5 py-8 text-[var(--ink)]">
      <section className="mx-auto w-full max-w-xl rounded-[1.4rem] border border-[var(--line)] bg-[var(--panel)]/90 p-6 shadow-[var(--elevation-lg)] backdrop-blur">
        <p className="m-0 text-[0.72rem] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">Listing Control Center</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--ink)]">Loading workspace</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">Preparing the authenticated workspace shell...</p>
      </section>
    </main>
  );
}

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const { users, usersLoading, usersReady, currentUser, requiresPasswordChange, accessiblePages, canAccessPage, logout } = useAuthSession();
  const routeState = useAppRouteState(location, accessiblePages);
  const {
    normalizedPath,
    isLoginPath,
    isResetPasswordPath,
    resetToken,
    firstAccessibleTab,
  } = routeState;

  useAuthRouteGuard({
    authReady: usersReady,
    currentUser,
    requiresPasswordChange,
    isLoginPath,
    isResetPasswordPath,
    normalizedPath,
    firstAccessibleTab,
    canAccessPage,
    navigate,
  });

  if (!usersReady) {
    return (
      <main className="min-h-screen px-5 py-8 text-[var(--ink)]">
        <section className="mx-auto w-full max-w-xl rounded-[1.4rem] border border-[var(--line)] bg-[var(--panel)]/90 p-6 shadow-[var(--elevation-lg)] backdrop-blur">
          <p className="m-0 text-[0.72rem] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">Listing Control Center</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--ink)]">Loading users</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
            {usersLoading ? 'Syncing account access from Airtable...' : 'Preparing account access...'}
          </p>
        </section>
      </main>
    );
  }

  if (!currentUser && isResetPasswordPath) {
    return (
      <ResetPasswordScreen
        token={resetToken}
        onResetSuccess={() => navigate('/login', { replace: true })}
        onBackToLogin={() => navigate('/login', { replace: true })}
      />
    );
  }

  if (!currentUser) {
    return <LoginScreen onLoggedIn={() => navigate('/dashboard', { replace: true })} />;
  }

  return (
    <Suspense fallback={<AuthenticatedAppShellFallback />}>
      <AuthenticatedAppShell
        currentUser={currentUser}
        users={users}
        accessiblePages={accessiblePages}
        canAccessPage={canAccessPage}
        logout={logout}
        requiresPasswordChange={requiresPasswordChange}
        routeState={routeState}
      />
    </Suspense>
  );
}

export default App;

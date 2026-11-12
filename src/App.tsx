import { LoadingSurface } from '@/components/app/StateSurfaces';
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
    <main className="min-h-screen">
      <LoadingSurface message="Loading workspace..." />
    </main>
  );
}

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const { users, usersReady, currentUser, requiresPasswordChange, accessiblePages, canAccessPage, logout } = useAuthSession();
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
      <main className="flex min-h-screen items-center justify-center px-5 text-[var(--ink)]">
        <div className="boot-loader"><LoadingSurface message="Loading..." /></div>
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

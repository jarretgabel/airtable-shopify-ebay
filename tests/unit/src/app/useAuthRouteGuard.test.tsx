import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useAuthRouteGuard } from '@/app/useAuthRouteGuard';

function GuardHarness({
  normalizedPath,
  canAccessPage = () => true,
  navigate = vi.fn(),
}: {
  normalizedPath: string;
  canAccessPage?: (tab: 'dashboard' | 'workflow-guide' | 'inventory' | 'listings' | 'shopify' | 'market' | 'parking-lot-1' | 'jotform' | 'manual-intake' | 'testing' | 'photos' | 'settings' | 'notifications' | 'imagelab' | 'ebay' | 'users' | 'parking-lot-2' | 'trash-review' | 'testing-queue' | 'photography-queue') => boolean;
  navigate?: ReturnType<typeof vi.fn>;
}) {
  useAuthRouteGuard({
    authReady: true,
    currentUser: { id: 'user-1' },
    requiresPasswordChange: false,
    isLoginPath: false,
    isResetPasswordPath: false,
    normalizedPath,
    firstAccessibleTab: 'dashboard',
    canAccessPage,
    navigate,
  });

  return null;
}

describe('useAuthRouteGuard', () => {
  it('redirects retired inventory workflow detail routes away', () => {
    const navigate = vi.fn();

    render(
      <GuardHarness
        normalizedPath="/inventory/workflow/rec-stale-1"
        canAccessPage={(tab) => tab === 'inventory' || tab === 'dashboard'}
        navigate={navigate}
      />,
    );

    expect(navigate).toHaveBeenCalledWith('/dashboard', { replace: true });
  });

  it('allows inventory price editor routes without redirecting away', () => {
    const navigate = vi.fn();

    render(
      <GuardHarness
        normalizedPath="/inventory/price/rec-stale-1"
        canAccessPage={(tab) => tab === 'inventory' || tab === 'dashboard'}
        navigate={navigate}
      />,
    );

    expect(navigate).not.toHaveBeenCalled();
  });

  it('allows the workflow guide route when the user has access', () => {
    const navigate = vi.fn();

    render(
      <GuardHarness
        normalizedPath="/workflow-guide"
        canAccessPage={(tab) => tab === 'workflow-guide' || tab === 'dashboard'}
        navigate={navigate}
      />,
    );

    expect(navigate).not.toHaveBeenCalled();
  });

  it('allows the manual-intake route when the user has access', () => {
    const navigate = vi.fn();

    render(
      <GuardHarness
        normalizedPath="/inventory/manual-intake"
        canAccessPage={(tab) => tab === 'manual-intake' || tab === 'dashboard'}
        navigate={navigate}
      />,
    );

    expect(navigate).not.toHaveBeenCalled();
  });

  it('redirects the blank testing route to the testing queue', () => {
    const navigate = vi.fn();

    render(
      <GuardHarness
        normalizedPath="/testing"
        canAccessPage={(tab) => tab === 'testing-queue' || tab === 'dashboard'}
        navigate={navigate}
      />,
    );

    expect(navigate).toHaveBeenCalledWith('/workflow/testing', { replace: true });
  });

  it('redirects the blank photos route to the photography queue', () => {
    const navigate = vi.fn();

    render(
      <GuardHarness
        normalizedPath="/photos"
        canAccessPage={(tab) => tab === 'photography-queue' || tab === 'dashboard'}
        navigate={navigate}
      />,
    );

    expect(navigate).toHaveBeenCalledWith('/workflow/photography', { replace: true });
  });

  it('redirects the retired pre-listing route away', () => {
    const navigate = vi.fn();

    render(
      <GuardHarness
        normalizedPath="/workflow/pre-listing"
        canAccessPage={(tab) => tab === 'listings' || tab === 'dashboard'}
        navigate={navigate}
      />,
    );

    expect(navigate).toHaveBeenCalledWith('/dashboard', { replace: true });
  });
});
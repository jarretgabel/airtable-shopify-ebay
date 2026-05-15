import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useAuthRouteGuard } from '@/app/useAuthRouteGuard';

function GuardHarness({
  normalizedPath,
  canAccessPage = () => true,
  navigate = vi.fn(),
}: {
  normalizedPath: string;
  canAccessPage?: (tab: 'dashboard' | 'workflow-guide' | 'inventory' | 'listings' | 'shopify' | 'market' | 'parking-lot-1' | 'jotform' | 'incoming-gear' | 'testing' | 'photos' | 'settings' | 'notifications' | 'imagelab' | 'ebay' | 'users' | 'parking-lot-2' | 'trash-review' | 'testing-queue' | 'photography-queue' | 'pre-listing-queue') => boolean;
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
  it('allows inventory workflow detail routes without redirecting away', () => {
    const navigate = vi.fn();

    render(
      <GuardHarness
        normalizedPath="/inventory/workflow/rec-stale-1"
        canAccessPage={(tab) => tab === 'inventory' || tab === 'dashboard'}
        navigate={navigate}
      />,
    );

    expect(navigate).not.toHaveBeenCalled();
  });

  it('allows workflow price editor routes without redirecting away', () => {
    const navigate = vi.fn();

    render(
      <GuardHarness
        normalizedPath="/inventory/workflow/rec-stale-1/price"
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
});
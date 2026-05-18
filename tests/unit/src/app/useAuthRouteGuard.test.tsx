import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useAuthRouteGuard } from '@/app/useAuthRouteGuard';

function GuardHarness({
  normalizedPath,
  canAccessPage = () => true,
  navigate = vi.fn(),
}: {
  normalizedPath: string;
  canAccessPage?: (tab: 'dashboard' | 'workflow-guide' | 'inventory' | 'listings' | 'post-publish' | 'shopify' | 'market' | 'parking-lot-1' | 'jotform' | 'manual-intake' | 'testing' | 'photos' | 'settings' | 'notifications' | 'imagelab' | 'ebay' | 'users' | 'parking-lot-2' | 'trash-review' | 'testing-queue' | 'photography-queue') => boolean;
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
        normalizedPath="/workflow-hub/price/rec-stale-1"
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

  it('allows the post-publish route when the user has access', () => {
    const navigate = vi.fn();

    render(
      <GuardHarness
        normalizedPath="/workflow/post-publish"
        canAccessPage={(tab) => tab === 'post-publish' || tab === 'dashboard'}
        navigate={navigate}
      />,
    );

    expect(navigate).not.toHaveBeenCalled();
  });

  it('allows Parking Lot 2 record review routes when the user has access', () => {
    const navigate = vi.fn();

    render(
      <GuardHarness
        normalizedPath="/parking-lot-2/rec-lot-two-1"
        canAccessPage={(tab) => tab === 'parking-lot-2' || tab === 'dashboard'}
        navigate={navigate}
      />,
    );

    expect(navigate).not.toHaveBeenCalled();
  });

  it('allows Parking Lot 2 grouped review routes when the user has access', () => {
    const navigate = vi.fn();

    render(
      <GuardHarness
        normalizedPath="/parking-lot-2/group/pickup%3Apickup-100"
        canAccessPage={(tab) => tab === 'parking-lot-2' || tab === 'dashboard'}
        navigate={navigate}
      />,
    );

    expect(navigate).not.toHaveBeenCalled();
  });

  it('allows grouped trash review routes when the user has access', () => {
    const navigate = vi.fn();

    render(
      <GuardHarness
        normalizedPath="/trash-review/group/trash-set-a"
        canAccessPage={(tab) => tab === 'trash-review' || tab === 'dashboard'}
        navigate={navigate}
      />,
    );

    expect(navigate).not.toHaveBeenCalled();
  });

  it('allows the manual-intake route when the user has access', () => {
    const navigate = vi.fn();

    render(
      <GuardHarness
        normalizedPath="/manual-intake"
        canAccessPage={(tab) => tab === 'manual-intake' || tab === 'dashboard'}
        navigate={navigate}
      />,
    );

    expect(navigate).not.toHaveBeenCalled();
  });

  it('redirects legacy manual-intake detail routes to the canonical intake detail path', () => {
    const navigate = vi.fn();

    render(
      <GuardHarness
        normalizedPath="/manual-intake/rec-legacy-1"
        canAccessPage={(tab) => tab === 'manual-intake' || tab === 'dashboard'}
        navigate={navigate}
      />,
    );

    expect(navigate).toHaveBeenCalledWith('/intake/rec-legacy-1', { replace: true });
  });

  it('redirects legacy pending-review record routes to the flattened Parking Lot 1 record path', () => {
    const navigate = vi.fn();

    render(
      <GuardHarness
        normalizedPath="/parking-lot-1/review-record/rec-legacy-1"
        canAccessPage={(tab) => tab === 'parking-lot-1' || tab === 'dashboard'}
        navigate={navigate}
      />,
    );

    expect(navigate).toHaveBeenCalledWith('/parking-lot-1/rec-legacy-1', { replace: true });
  });

  it('redirects the legacy workflow hub root to the new path', () => {
    const navigate = vi.fn();

    render(
      <GuardHarness
        normalizedPath="/inventory"
        canAccessPage={(tab) => tab === 'inventory' || tab === 'dashboard'}
        navigate={navigate}
      />,
    );

    expect(navigate).toHaveBeenCalledWith('/workflow-hub', { replace: true });
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
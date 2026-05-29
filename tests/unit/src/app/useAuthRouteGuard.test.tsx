import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useAuthRouteGuard } from '@/app/useAuthRouteGuard';
import type { AppPage } from '@/auth/pages';

const { loadUsedGearOperationalRecordMock } = vi.hoisted(() => ({
  loadUsedGearOperationalRecordMock: vi.fn(),
}));

vi.mock('@/services/usedGearQueue', () => ({
  loadUsedGearOperationalRecord: loadUsedGearOperationalRecordMock,
}));

function GuardHarness({
  normalizedPath,
  canAccessPage = () => true,
  navigate = vi.fn(),
}: {
  normalizedPath: string;
  canAccessPage?: (tab: AppPage) => boolean;
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
  it('redirects legacy pending-review record routes to the current parking lot arrival path when the item has advanced', async () => {
    const navigate = vi.fn();
    loadUsedGearOperationalRecordMock.mockResolvedValueOnce({
      id: 'rec-legacy-1',
      createdTime: '2026-05-09T00:00:00.000Z',
      fields: {
        'Workflow Status': 'Accepted - Awaiting Arrival',
      },
    });

    render(
      <GuardHarness
        normalizedPath="/parking-lot/review-record/rec-legacy-1"
        canAccessPage={(tab) => tab === 'parking-lot' || tab === 'dashboard'}
        navigate={navigate}
      />,
    );

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('/parking-lot/arrival/rec-legacy-1', { replace: true });
    });
  });

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

  it('allows the workflow guide editor route when the user has access', () => {
    const navigate = vi.fn();

    render(
      <GuardHarness
        normalizedPath="/workflow-guide/edit"
        canAccessPage={(tab) => tab === 'workflow-guide' || tab === 'workflow-guide-editor' || tab === 'dashboard'}
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

  it('allows Parking Lot arrival-stage record review routes when the user has access', () => {
    const navigate = vi.fn();

    render(
      <GuardHarness
        normalizedPath="/parking-lot/arrival/rec-lot-two-1"
        canAccessPage={(tab) => tab === 'parking-lot' || tab === 'dashboard'}
        navigate={navigate}
      />,
    );

    expect(navigate).not.toHaveBeenCalled();
  });

  it('allows Parking Lot arrival-stage grouped review routes when the user has access', () => {
    const navigate = vi.fn();

    render(
      <GuardHarness
        normalizedPath="/parking-lot/arrival/group/pickup%3Apickup-100"
        canAccessPage={(tab) => tab === 'parking-lot' || tab === 'dashboard'}
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

  it('allows the create-intake-item route when the user has access', () => {
    const navigate = vi.fn();

    render(
      <GuardHarness
        normalizedPath="/create-intake-item"
        canAccessPage={(tab) => tab === 'create-intake-item' || tab === 'dashboard'}
        navigate={navigate}
      />,
    );

    expect(navigate).not.toHaveBeenCalled();
  });

  it('allows the jotform audit route when the user has access', () => {
    const navigate = vi.fn();

    render(
      <GuardHarness
        normalizedPath="/jotform-audit"
        canAccessPage={(tab) => tab === 'jotform-audit' || tab === 'dashboard'}
        navigate={navigate}
      />,
    );

    expect(navigate).not.toHaveBeenCalled();
  });

  it('redirects legacy intake detail routes to the canonical manual-intake detail path', () => {
    const navigate = vi.fn();

    render(
      <GuardHarness
        normalizedPath="/intake/rec-legacy-1"
        canAccessPage={(tab) => tab === 'manual-intake' || tab === 'dashboard'}
        navigate={navigate}
      />,
    );

    expect(navigate).toHaveBeenCalledWith('/manual-intake/rec-legacy-1', { replace: true });
  });

  it('falls back to the flattened Parking Lot record path when a legacy pending-review record cannot be resolved', async () => {
    const navigate = vi.fn();
    loadUsedGearOperationalRecordMock.mockRejectedValueOnce(new Error('not found'));

    render(
      <GuardHarness
        normalizedPath="/parking-lot/review-record/rec-legacy-1"
        canAccessPage={(tab) => tab === 'parking-lot' || tab === 'dashboard'}
        navigate={navigate}
      />,
    );

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('/parking-lot/rec-legacy-1', { replace: true });
    });
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

  it('keeps the testing route as the queue landing surface', () => {
    const navigate = vi.fn();

    render(
      <GuardHarness
        normalizedPath="/testing"
        canAccessPage={(tab) => tab === 'testing-queue' || tab === 'dashboard'}
        navigate={navigate}
      />,
    );

    expect(navigate).not.toHaveBeenCalled();
  });

  it('redirects the retired photos route away', () => {
    const navigate = vi.fn();

    render(
      <GuardHarness
        normalizedPath="/photos"
        canAccessPage={(tab) => tab === 'photography-queue' || tab === 'dashboard'}
        navigate={navigate}
      />,
    );

    expect(navigate).toHaveBeenCalledWith('/dashboard', { replace: true });
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
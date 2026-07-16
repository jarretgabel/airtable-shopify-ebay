import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useAuthRouteGuard } from '@/app/useAuthRouteGuard';
import type { AppPage } from '@/auth/pages';

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
        normalizedPath="/post-publish"
        canAccessPage={(tab) => tab === 'post-publish' || tab === 'dashboard'}
        navigate={navigate}
      />,
    );

    expect(navigate).not.toHaveBeenCalled();
  });

  it('allows sold-ready listings detail routes when the user has access', () => {
    const navigate = vi.fn();

    render(
      <GuardHarness
        normalizedPath="/sold-ready/rec-sold-1"
        canAccessPage={(tab) => tab === 'post-publish' || tab === 'dashboard'}
        navigate={navigate}
      />,
    );

    expect(navigate).not.toHaveBeenCalled();
  });

  it('allows post-publish detail routes when the user has access', () => {
    const navigate = vi.fn();

    render(
      <GuardHarness
        normalizedPath="/post-publish/rec-post-1"
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

});
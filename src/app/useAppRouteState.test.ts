import type { Location } from 'react-router-dom';
import { useAppRouteState } from '@/app/useAppRouteState';

function locationFor(pathname: string, search = ''): Location {
  return {
    pathname,
    search,
    hash: '',
    state: null,
    key: 'test',
    unstable_mask: undefined,
  };
}

describe('useAppRouteState', () => {
  it('maps approval detail route and decodes id', () => {
    const state = useAppRouteState(locationFor('/ebay/approval/abc%20123'), ['dashboard']);
    expect(state.activeTab).toBe('approval');
    expect(state.approvalRecordId).toBe('abc 123');
  });

  it('maps users detail route and decodes id', () => {
    const state = useAppRouteState(locationFor('/account/users/u%40id'), ['dashboard']);
    expect(state.activeTab).toBe('users');
    expect(state.userRecordId).toBe('u@id');
  });

  it('uses first accessible tab fallback', () => {
    const state = useAppRouteState(locationFor('/unknown'), ['market', 'dashboard']);
    expect(state.firstAccessibleTab).toBe('market');
    expect(state.activeTab).toBe('dashboard');
  });

  it('detects reset-password and token', () => {
    const state = useAppRouteState(locationFor('/reset-password', '?token=123'), ['dashboard']);
    expect(state.isResetPasswordPath).toBe(true);
    expect(state.resetToken).toBe('123');
  });

  it('maps the dedicated incoming-gear route', () => {
    const state = useAppRouteState(locationFor('/incoming-gear'), ['dashboard', 'incoming-gear']);
    expect(state.activeTab).toBe('incoming-gear');
  });

  it('maps the dedicated photos route', () => {
    const state = useAppRouteState(locationFor('/photos'), ['dashboard', 'photos']);
    expect(state.activeTab).toBe('photos');
  });
});

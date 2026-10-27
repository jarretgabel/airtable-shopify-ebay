import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ListingEditHistory } from '@/components/approval/ListingEditHistory';

const mocks = vi.hoisted(() => ({ role: 'admin', getRecordHistory: vi.fn() }));

vi.mock('@/services/app-api/dashboard', () => ({ getRecordHistory: mocks.getRecordHistory }));
vi.mock('@/stores/auth/authStore', () => ({
  useAuthStore: (select: (state: unknown) => unknown) =>
    select({ users: [{ id: 'u1', role: mocks.role }], currentUserId: 'u1' }),
}));

describe('ListingEditHistory', () => {
  beforeEach(() => {
    mocks.role = 'admin';
    mocks.getRecordHistory.mockReset();
  });

  it('loads and shows edits when opened', async () => {
    mocks.getRecordHistory.mockResolvedValue([
      { id: '1', at: '2026-10-26T12:00:00.000Z', op: 'update', fields: { Description: 'New text' } },
    ]);
    const { container } = render(<ListingEditHistory recordId="rec1" />);
    const details = container.querySelector('details') as HTMLDetailsElement;
    details.open = true;
    fireEvent(details, new Event('toggle'));
    await waitFor(() => expect(screen.getByText('New text')).toBeTruthy());
    expect(mocks.getRecordHistory).toHaveBeenCalledWith('approval-combined', 'rec1');
  });

  it('renders nothing for roles without full access', () => {
    mocks.role = 'processor';
    const { container } = render(<ListingEditHistory recordId="rec1" />);
    expect(container.innerHTML).toBe('');
  });
});

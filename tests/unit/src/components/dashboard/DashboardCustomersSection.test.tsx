import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DashboardCustomersSection } from '@/components/dashboard/DashboardCustomersSection';

const detail = {
  contact: { id: 'c1', email: 'ann@x.com', name: 'Ann', phone: null, location: 'NYC', mailingListOptIn: false },
  items: [{ recordId: 'r1', sku: '100', make: 'McIntosh', model: 'MC275', status: 'Shipped' }],
  interactions: [],
  followUps: [{ id: 'f1', dueAt: '2026-10-01T09:00:00.000Z', status: 'open', note: 'Call back' }],
};

function makeApi() {
  return {
    searchCrmContacts: vi.fn().mockResolvedValue([{ id: 'c1', email: 'ann@x.com', name: 'Ann', location: 'NYC', itemCount: 1, openFollowUps: 1 }]),
    getCrmContact: vi.fn().mockResolvedValue(detail),
    getCrmDueFollowUps: vi.fn().mockResolvedValue([]),
    addCrmInteraction: vi.fn().mockResolvedValue({ saved: true }),
    addCrmFollowUp: vi.fn().mockResolvedValue({ saved: true }),
    closeCrmFollowUp: vi.fn().mockResolvedValue({ saved: true }),
  };
}

describe('DashboardCustomersSection', () => {
  it('opens a customer and saves a note, then refreshes', async () => {
    const api = makeApi();
    render(<DashboardCustomersSection api={api} />);
    fireEvent.click(await screen.findByText('Ann'));
    await screen.findByText(/100 McIntosh MC275/);

    fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'Discussed price' } });
    fireEvent.click(screen.getByText('Add note'));
    await waitFor(() => expect(api.addCrmInteraction).toHaveBeenCalledWith('c1', 'note', 'Discussed price'));
    await waitFor(() => expect(api.getCrmContact).toHaveBeenCalledTimes(2));
  });

  it('closes an open follow-up', async () => {
    const api = makeApi();
    render(<DashboardCustomersSection api={api} />);
    fireEvent.click(await screen.findByText('Ann'));
    await screen.findByText(/Call back/);
    fireEvent.click(screen.getAllByText('Done')[0]);
    await waitFor(() => expect(api.closeCrmFollowUp).toHaveBeenCalledWith('f1', 'done'));
  });

  it('stays hidden when loading fails and warnings are off', async () => {
    const api = makeApi();
    api.searchCrmContacts.mockRejectedValue(new Error('down'));
    const { container } = render(<DashboardCustomersSection api={api} />);
    await waitFor(() => expect(api.searchCrmContacts).toHaveBeenCalled());
    await waitFor(() => expect(container.innerHTML).toBe(''));
  });
});

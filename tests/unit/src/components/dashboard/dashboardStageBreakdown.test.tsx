import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DashboardStageBreakdown, getStageRows } from '@/components/dashboard/DashboardStageBreakdown';
import { USED_GEAR_WORKFLOW_STATUSES } from '@/services/usedGearWorkflow';

function counts(overrides: Record<string, number>) {
  const base = Object.fromEntries(USED_GEAR_WORKFLOW_STATUSES.map((status) => [status, 0]));
  return { ...base, ...overrides } as Parameters<typeof getStageRows>[0];
}

describe('DashboardStageBreakdown', () => {
  it('groups statuses into stages and excludes trash', () => {
    const rows = getStageRows(counts({ Unqualified: 9, 'Accepted - Arrived, Awaiting SKU': 2, 'Accepted - Arrived, Awaiting Missing Item': 1, 'Awaiting Pre-Listing Review': 3, 'Approved for Publish': 1 }));
    expect(rows.find((row) => row.label === 'Awaiting SKU / missing item')?.count).toBe(3);
    expect(rows.find((row) => row.label === 'Ready to list')?.count).toBe(4);
    expect(rows.reduce((total, row) => total + row.count, 0)).toBe(7);
  });

  it('shows totals and links only to pages the user can open', () => {
    const onSelectTab = vi.fn();
    render(<DashboardStageBreakdown counts={counts({ 'Testing In Progress': 5, 'Photography In Progress': 2 })} accessiblePages={['testing-queue']} onSelectTab={onSelectTab} />);
    expect(screen.getByText('7 active')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Testing/ }));
    expect(onSelectTab).toHaveBeenCalledWith('testing-queue');
    expect(screen.queryByRole('button', { name: /Photography/ })).not.toBeInTheDocument();
  });

  it('renders nothing when there are no active products', () => {
    const { container } = render(<DashboardStageBreakdown counts={counts({})} accessiblePages={[]} onSelectTab={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ListingApprovalWorkflowOpsPanel } from '@/components/approval/ListingApprovalWorkflowOpsPanel';
import type { AirtableRecord } from '@/types/airtable';

const {
  loadUsedGearOperationalRecordContextMock,
  markWorkflowListingStaleMock,
} = vi.hoisted(() => ({
  loadUsedGearOperationalRecordContextMock: vi.fn(),
  markWorkflowListingStaleMock: vi.fn(),
}));

vi.mock('@/services/usedGearQueue', async () => {
  const actual = await vi.importActual<typeof import('@/services/usedGearQueue')>('@/services/usedGearQueue');
  return {
    ...actual,
    loadUsedGearOperationalRecordContext: loadUsedGearOperationalRecordContextMock,
    markWorkflowListingStale: markWorkflowListingStaleMock,
  };
});

function buildRecord(overrides: Record<string, unknown> = {}): AirtableRecord {
  return {
    id: 'rec-workflow-1',
    createdTime: '2026-05-01T00:00:00.000Z',
    fields: {
      SKU: 'MC-240',
      Make: 'McIntosh',
      Model: 'MC240',
      'Workflow Status': 'Listed, Shopify',
      'Listed At': '2026-05-02T00:00:00.000Z',
      'Inventory Notes': 'Fresh caps installed.',
      ...overrides,
    },
  };
}

describe('ListingApprovalWorkflowOpsPanel', () => {
  beforeEach(() => {
    loadUsedGearOperationalRecordContextMock.mockReset();
    markWorkflowListingStaleMock.mockReset();
  });

  it('renders grouped workflow context and audit details inside Listings', async () => {
    loadUsedGearOperationalRecordContextMock.mockResolvedValue({
      record: buildRecord({ 'Workflow Source': 'JotForm' }),
      group: {
        id: 'submission:1',
        key: 'submission:1',
        label: 'SUB-1',
        description: 'Submission group',
        records: [
          buildRecord({}),
          {
            id: 'rec-workflow-2',
            createdTime: '2026-05-01T00:00:00.000Z',
            fields: {
              SKU: 'MC-275',
              Make: 'McIntosh',
              Model: 'MC275',
              'Workflow Status': 'Awaiting Pre-Listing Review',
              'Offer Amount': 1200,
            },
          },
        ],
      },
    });

    render(
      <ListingApprovalWorkflowOpsPanel
        selectedRecord={buildRecord()}
        tableReference="appApproval/table"
        loadRecords={vi.fn(async () => {})}
        onOpenOperationalRecord={vi.fn()}
      />,
    );

    expect(await screen.findByText('Workflow Audit And Notes')).toBeInTheDocument();
    expect(screen.getByText('Grouped Submission Context')).toBeInTheDocument();
    expect(screen.getByText(/This row shares a submission group/i)).toBeInTheDocument();
    expect(screen.getByText('Workflow Source: JotForm')).toBeInTheDocument();
    expect(screen.getAllByText('Inventory Notes: Fresh caps installed.').length).toBeGreaterThan(0);
  });

  it('runs post-publish stale actions and reloads the Listings table', async () => {
    const loadRecords = vi.fn(async () => {});
    const updatedRecord = buildRecord({ 'Workflow Status': 'Stale Listing, Shopify' });

    loadUsedGearOperationalRecordContextMock.mockResolvedValue({
      record: buildRecord(),
      group: null,
    });
    markWorkflowListingStaleMock.mockResolvedValue(updatedRecord);

    render(
      <ListingApprovalWorkflowOpsPanel
        selectedRecord={buildRecord()}
        tableReference="appApproval/table"
        loadRecords={loadRecords}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Mark Stale' }));

    await waitFor(() => {
      expect(markWorkflowListingStaleMock).toHaveBeenCalledWith('rec-workflow-1');
      expect(loadRecords).toHaveBeenCalledWith('appApproval/table', undefined, true);
    });
  });
});
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ListingApprovalWorkflowOpsPanel } from '@/components/approval/ListingApprovalWorkflowOpsPanel';
import type { AirtableRecord } from '@/types/airtable';

const {
  loadUsedGearOperationalRecordContextMock,
  markWorkflowListingStaleMock,
  takeDownWorkflowMarketplaceListingAndMoveBackMock,
  updateRecordFromResolvedSourceMock,
} = vi.hoisted(() => ({
  loadUsedGearOperationalRecordContextMock: vi.fn(),
  markWorkflowListingStaleMock: vi.fn(),
  takeDownWorkflowMarketplaceListingAndMoveBackMock: vi.fn(),
  updateRecordFromResolvedSourceMock: vi.fn(),
}));

vi.mock('@/services/app-api/airtable', () => ({
  updateRecordFromResolvedSource: updateRecordFromResolvedSourceMock,
}));

vi.mock('@/services/usedGearQueue', async () => {
  const actual = await vi.importActual<typeof import('@/services/usedGearQueue')>('@/services/usedGearQueue');
  return {
    ...actual,
    loadUsedGearOperationalRecordContext: loadUsedGearOperationalRecordContextMock,
    markWorkflowListingStale: markWorkflowListingStaleMock,
    takeDownWorkflowMarketplaceListingAndMoveBack: takeDownWorkflowMarketplaceListingAndMoveBackMock,
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
    takeDownWorkflowMarketplaceListingAndMoveBackMock.mockReset();
    updateRecordFromResolvedSourceMock.mockReset();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('does not render the removed workflow audit section inside Listings', async () => {
    loadUsedGearOperationalRecordContextMock.mockResolvedValue({
      record: buildRecord({ 'Workflow Source': 'JotForm' }),
      group: {
        id: 'submission:1',
        key: '1',
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
      />,
    );

    await waitFor(() => {
      expect(loadUsedGearOperationalRecordContextMock).toHaveBeenCalledWith('rec-workflow-1');
    });

    expect(screen.queryByText('Workflow Audit And Notes')).not.toBeInTheDocument();
    expect(screen.queryByText('Grouped Submission Context')).not.toBeInTheDocument();
    expect(screen.queryByText(/This row shares a submission group/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Workflow Source: JotForm')).not.toBeInTheDocument();
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

  it('runs shopify takedown and moves the row back to ready', async () => {
    const loadRecords = vi.fn(async () => {});
    const updatedRecord = buildRecord({
      'Workflow Status': 'Approved for Publish',
      'Shopify REST Product ID': '12345',
    });

    loadUsedGearOperationalRecordContextMock.mockResolvedValue({
      record: buildRecord({ 'Shopify REST Product ID': '12345' }),
      group: null,
    });
    takeDownWorkflowMarketplaceListingAndMoveBackMock.mockResolvedValue(updatedRecord);

    render(
      <ListingApprovalWorkflowOpsPanel
        selectedRecord={buildRecord({ 'Shopify REST Product ID': '12345' })}
        tableReference="appApproval/table"
        loadRecords={loadRecords}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Take Down Shopify + Back To Ready' }));

    await waitFor(() => {
      expect(takeDownWorkflowMarketplaceListingAndMoveBackMock).toHaveBeenCalledWith('rec-workflow-1', 'shopify');
      expect(loadRecords).toHaveBeenCalledWith('appApproval/table', undefined, true);
    });
  });

  it('does not run shopify takedown when confirm is cancelled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    loadUsedGearOperationalRecordContextMock.mockResolvedValue({
      record: buildRecord({ 'Shopify REST Product ID': '12345' }),
      group: null,
    });

    render(
      <ListingApprovalWorkflowOpsPanel
        selectedRecord={buildRecord({ 'Shopify REST Product ID': '12345' })}
        tableReference="appApproval/table"
        loadRecords={vi.fn(async () => {})}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Take Down Shopify + Back To Ready' }));

    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalled();
    });
    expect(takeDownWorkflowMarketplaceListingAndMoveBackMock).not.toHaveBeenCalled();
  });

  it('runs ebay takedown and moves the row back to ready', async () => {
    const loadRecords = vi.fn(async () => {});
    const updatedRecord = buildRecord({
      'Workflow Status': 'Approved for Publish',
      'eBay Item ID': '98765',
    });

    loadUsedGearOperationalRecordContextMock.mockResolvedValue({
      record: buildRecord({ 'Workflow Status': 'Listed, eBay', 'eBay Item ID': '98765' }),
      group: null,
    });
    takeDownWorkflowMarketplaceListingAndMoveBackMock.mockResolvedValue(updatedRecord);

    render(
      <ListingApprovalWorkflowOpsPanel
        selectedRecord={buildRecord({ 'Workflow Status': 'Listed, eBay', 'eBay Item ID': '98765' })}
        tableReference="appApproval/table"
        loadRecords={loadRecords}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Take Down eBay + Back To Ready' }));

    await waitFor(() => {
      expect(takeDownWorkflowMarketplaceListingAndMoveBackMock).toHaveBeenCalledWith('rec-workflow-1', 'ebay');
      expect(loadRecords).toHaveBeenCalledWith('appApproval/table', undefined, true);
    });
  });

  it('does not run ebay takedown when confirm is cancelled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    loadUsedGearOperationalRecordContextMock.mockResolvedValue({
      record: buildRecord({ 'Workflow Status': 'Listed, eBay', 'eBay Item ID': '98765' }),
      group: null,
    });

    render(
      <ListingApprovalWorkflowOpsPanel
        selectedRecord={buildRecord({ 'Workflow Status': 'Listed, eBay', 'eBay Item ID': '98765' })}
        tableReference="appApproval/table"
        loadRecords={vi.fn(async () => {})}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Take Down eBay + Back To Ready' }));

    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalled();
    });
    expect(takeDownWorkflowMarketplaceListingAndMoveBackMock).not.toHaveBeenCalled();
  });

  it('keeps shopify takedown action visible when refreshed workflow context omits product id field', async () => {
    loadUsedGearOperationalRecordContextMock.mockResolvedValue({
      record: buildRecord(),
      group: null,
    });

    render(
      <ListingApprovalWorkflowOpsPanel
        selectedRecord={buildRecord({ 'Shopify REST Product ID': '12345' })}
        tableReference="appApproval/table"
        loadRecords={vi.fn(async () => {})}
      />,
    );

    expect(await screen.findByRole('button', { name: 'Take Down Shopify + Back To Ready' })).toBeInTheDocument();
  });

  it('shows shopify takedown action for Listed, Shopify even when product id is missing', async () => {
    loadUsedGearOperationalRecordContextMock.mockResolvedValue({
      record: buildRecord({ 'Shopify REST Product ID': '' }),
      group: null,
    });

    render(
      <ListingApprovalWorkflowOpsPanel
        selectedRecord={buildRecord({ 'Shopify REST Product ID': '' })}
        tableReference="appApproval/table"
        loadRecords={vi.fn(async () => {})}
      />,
    );

    expect(await screen.findByRole('button', { name: 'Take Down Shopify + Back To Ready' })).toBeInTheDocument();
  });

  it('skips source sync write when current source is used-gear-workflow', async () => {
    const loadRecords = vi.fn(async () => {});
    const updatedRecord = buildRecord({
      'Workflow Status': 'Approved for Publish',
      'Shopify REST Product ID': '12345',
    });

    loadUsedGearOperationalRecordContextMock.mockResolvedValue({
      record: buildRecord({ 'Shopify REST Product ID': '12345' }),
      group: null,
    });
    takeDownWorkflowMarketplaceListingAndMoveBackMock.mockResolvedValue(updatedRecord);

    render(
      <ListingApprovalWorkflowOpsPanel
        selectedRecord={buildRecord({ 'Shopify REST Product ID': '12345' })}
        tableReference="used-gear-workflow"
        loadRecords={loadRecords}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Take Down Shopify + Back To Ready' }));

    await waitFor(() => {
      expect(takeDownWorkflowMarketplaceListingAndMoveBackMock).toHaveBeenCalledWith('rec-workflow-1', 'shopify');
    });

    expect(updateRecordFromResolvedSourceMock).not.toHaveBeenCalled();
  });

  it('skips source sync write when current source resolves to approval-combined', async () => {
    const loadRecords = vi.fn(async () => {});
    const updatedRecord = buildRecord({
      'Workflow Status': 'Approved for Publish',
      'Shopify REST Product ID': '12345',
    });

    loadUsedGearOperationalRecordContextMock.mockResolvedValue({
      record: buildRecord({ 'Shopify REST Product ID': '12345' }),
      group: null,
    });
    takeDownWorkflowMarketplaceListingAndMoveBackMock.mockResolvedValue(updatedRecord);

    render(
      <ListingApprovalWorkflowOpsPanel
        selectedRecord={buildRecord({ 'Shopify REST Product ID': '12345' })}
        tableReference="approval-combined"
        loadRecords={loadRecords}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Take Down Shopify + Back To Ready' }));

    await waitFor(() => {
      expect(takeDownWorkflowMarketplaceListingAndMoveBackMock).toHaveBeenCalledWith('rec-workflow-1', 'shopify');
    });

    expect(updateRecordFromResolvedSourceMock).not.toHaveBeenCalled();
  });

});
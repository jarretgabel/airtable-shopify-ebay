import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ListingApprovalWorkflowOpsPanel } from '@/components/approval/ListingApprovalWorkflowOpsPanel';
import type { AirtableRecord } from '@/types/airtable';

const {
  loadUsedGearOperationalRecordContextMock,
  markWorkflowListingStaleMock,
  takeDownWorkflowMarketplaceListingAndMoveBackMock,
  updateRecordFromResolvedSourceMock,
  getProductMock,
  getOfferMock,
} = vi.hoisted(() => ({
  loadUsedGearOperationalRecordContextMock: vi.fn(),
  markWorkflowListingStaleMock: vi.fn(),
  takeDownWorkflowMarketplaceListingAndMoveBackMock: vi.fn(),
  updateRecordFromResolvedSourceMock: vi.fn(),
  getProductMock: vi.fn(),
  getOfferMock: vi.fn(),
}));

vi.mock('@/services/app-api/shopify', () => ({ getProduct: getProductMock }));
vi.mock('@/services/app-api/ebay', () => ({ getOffer: getOfferMock }));

vi.mock('@/services/app-api/airtable', () => ({
  updateRecordFromResolvedSource: updateRecordFromResolvedSourceMock,
}));

vi.mock('@/services/usedGearQueue', async () => {
  const actual = await vi.importActual<typeof import('@/services/usedGearQueue')>('@/services/usedGearQueue');
  return {
    ...actual,
    loadUsedGearOperationalRecord: async (recordId: string) => (
      await loadUsedGearOperationalRecordContextMock(recordId)
    ).record,
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
    getProductMock.mockReset().mockResolvedValue({ id: 12345, status: 'ACTIVE', onlineStoreUrl: 'https://test-shop.myshopify.com/products/test' });
    getOfferMock.mockReset().mockResolvedValue({ offerId: 'offer-1', status: 'PUBLISHED' });
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

  it('shows lifecycle timestamps in a human-readable local date and time format', async () => {
    const listedAt = '2026-10-07T23:48:13.449Z';
    const record = buildRecord({ 'Listed At': listedAt });
    loadUsedGearOperationalRecordContextMock.mockResolvedValue({
      record,
      group: null,
    });

    render(
      <ListingApprovalWorkflowOpsPanel
        selectedRecord={record}
        tableReference="used-gear-workflow"
        loadRecords={vi.fn(async () => {})}
      />,
    );

    const expectedDisplay = new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(listedAt));

    expect(await screen.findByText(expectedDisplay)).toBeInTheDocument();
    expect(screen.queryByText(listedAt)).not.toBeInTheDocument();
  });

  it('shows both channels when Shopify and eBay verify as live', async () => {
    const record = buildRecord({ 'Shopify REST Product ID': '12345', 'eBay Offer ID': 'offer-1' });
    loadUsedGearOperationalRecordContextMock.mockResolvedValue({ record, group: null });
    render(<ListingApprovalWorkflowOpsPanel selectedRecord={record} tableReference="used-gear-workflow" loadRecords={vi.fn()} />);
    expect(await screen.findByText('Listed, Shopify + eBay')).toBeInTheDocument();
    expect(getProductMock).toHaveBeenCalledWith(12345);
    expect(getOfferMock).toHaveBeenCalledWith('offer-1');
  });

  it('does not claim Shopify is live when the ACTIVE product is unpublished to Online Store', async () => {
    const record = buildRecord({ 'Shopify REST Product ID': '12345', 'eBay Offer ID': 'offer-1' });
    getProductMock.mockResolvedValue({ id: 12345, status: 'ACTIVE', onlineStoreUrl: null });
    loadUsedGearOperationalRecordContextMock.mockResolvedValue({ record, group: null });
    render(<ListingApprovalWorkflowOpsPanel selectedRecord={record} tableReference="used-gear-workflow" loadRecords={vi.fn()} />);
    expect(await screen.findByText('Listed, eBay')).toBeInTheDocument();
    expect(screen.queryByText('Listed, Shopify + eBay')).not.toBeInTheDocument();
  });

  it('does not treat historical eBay identifiers as proof of a live listing', async () => {
    const record = buildRecord({ 'Shopify REST Product ID': '12345', 'eBay Offer ID': 'offer-1' });
    getOfferMock.mockResolvedValue({ offerId: 'offer-1', status: 'UNPUBLISHED' });
    loadUsedGearOperationalRecordContextMock.mockResolvedValue({ record, group: null });
    render(<ListingApprovalWorkflowOpsPanel selectedRecord={record} tableReference="used-gear-workflow" loadRecords={vi.fn()} />);
    await waitFor(() => expect(getOfferMock).toHaveBeenCalled());
    expect(await screen.findByText('Listed, Shopify')).toBeInTheDocument();
    expect(screen.queryByText('Listed, Shopify + eBay')).not.toBeInTheDocument();
  });

  it('shows historical closure details read-only without marking a republished listing closed', async () => {
    const record = buildRecord({
      'Shopify REST Product ID': '12345',
      'eBay Offer ID': 'offer-1',
      'eBay Closed At': '2026-05-01T12:00:00.000Z',
      'eBay Close Result': 'eBay offer withdrawn',
      'Shopify Closed At': '2026-04-30T12:00:00.000Z',
      'Shopify Close Result': 'Shopify product deleted',
    });
    loadUsedGearOperationalRecordContextMock.mockResolvedValue({ record, group: null });
    render(<ListingApprovalWorkflowOpsPanel selectedRecord={record} tableReference="used-gear-workflow" loadRecords={vi.fn()} />);
    expect(await screen.findByText('Listed, Shopify + eBay')).toBeInTheDocument();
    expect(screen.getByText('Marketplace Closure History')).toBeInTheDocument();
    expect(screen.getByText('eBay last close result')).toBeInTheDocument();
    expect(screen.getByText('eBay offer withdrawn')).toBeInTheDocument();
    expect(screen.getByText('Shopify product deleted')).toBeInTheDocument();
    expect(screen.getByText(/not current listing status/i)).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /close result|closed at/i })).not.toBeInTheDocument();
    expect(updateRecordFromResolvedSourceMock).not.toHaveBeenCalled();
    expect(takeDownWorkflowMarketplaceListingAndMoveBackMock).not.toHaveBeenCalled();
  });

  it('keeps failed close history visible when the record is back in Ready', async () => {
    const record = buildRecord({
      'Workflow Status': 'Approved for Publish',
      'eBay Close Result': 'eBay withdraw error: 404 offer not found',
      'eBay Closed At': '2026-05-01T12:00:00.000Z',
    });
    loadUsedGearOperationalRecordContextMock.mockResolvedValue({ record, group: null });
    render(<ListingApprovalWorkflowOpsPanel selectedRecord={record} tableReference="used-gear-workflow" loadRecords={vi.fn()} />);
    expect(await screen.findByText('eBay withdraw error: 404 offer not found')).toBeInTheDocument();
    expect(screen.getByText(/failed attempts/i)).toBeInTheDocument();
    expect(screen.queryByText('Post-Publish Lifecycle')).not.toBeInTheDocument();
    expect(getOfferMock).not.toHaveBeenCalled();
    expect(updateRecordFromResolvedSourceMock).not.toHaveBeenCalled();
  });

  it('shows a date-only closure date without shifting the calendar day or inventing a time', async () => {
    const record = buildRecord({ 'eBay Closed At': '2026-10-14' });
    loadUsedGearOperationalRecordContextMock.mockResolvedValue({ record, group: null });
    render(<ListingApprovalWorkflowOpsPanel selectedRecord={record} tableReference="used-gear-workflow" loadRecords={vi.fn()} />);
    const expected = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date('2026-10-14'));
    expect(await screen.findByText(expected)).toBeInTheDocument();
  });

  it('reports verification errors instead of claiming both channels are live', async () => {
    const record = buildRecord({ 'Shopify REST Product ID': '12345', 'eBay Offer ID': 'offer-1' });
    getOfferMock.mockRejectedValue(new Error('eBay is unavailable'));
    loadUsedGearOperationalRecordContextMock.mockResolvedValue({ record, group: null });
    render(<ListingApprovalWorkflowOpsPanel selectedRecord={record} tableReference="used-gear-workflow" loadRecords={vi.fn()} />);
    expect(await screen.findByText(/Could not verify marketplace listing status: eBay is unavailable/)).toBeInTheDocument();
    expect(screen.queryByText('Listed, Shopify + eBay')).not.toBeInTheDocument();
  });

  it('rechecks unchanged offer IDs after publishing finishes', async () => {
    const record = buildRecord({ 'Shopify REST Product ID': '12345', 'eBay Offer ID': 'offer-1' });
    loadUsedGearOperationalRecordContextMock.mockResolvedValue({ record, group: null });
    getOfferMock.mockResolvedValue({ offerId: 'offer-1', status: 'UNPUBLISHED' });
    const props = { selectedRecord: record, tableReference: 'used-gear-workflow', loadRecords: vi.fn() };
    const { rerender } = render(<ListingApprovalWorkflowOpsPanel {...props} />);
    expect(await screen.findByText('Listed, Shopify')).toBeInTheDocument();
    rerender(<ListingApprovalWorkflowOpsPanel {...props} publishing />);
    getOfferMock.mockResolvedValue({ offerId: 'offer-1', status: 'PUBLISHED' });
    rerender(<ListingApprovalWorkflowOpsPanel {...props} publishing={false} />);
    expect(await screen.findByText('Listed, Shopify + eBay')).toBeInTheDocument();
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

  it('shows compact takedown labels without a workflow-only Back to Ready action', async () => {
    const record = buildRecord({ 'Shopify REST Product ID': '12345', 'eBay Offer ID': 'offer-1' });
    loadUsedGearOperationalRecordContextMock.mockResolvedValue({ record, group: null });

    render(
      <ListingApprovalWorkflowOpsPanel
        selectedRecord={record}
        tableReference="used-gear-workflow"
        loadRecords={vi.fn(async () => {})}
      />,
    );

    const shopifyButton = await screen.findByRole('button', { name: 'Take Down Shopify' });
    expect(shopifyButton).toHaveAttribute('title', 'Remove the Shopify listing and return this record to Ready for listing.');
    expect(shopifyButton.parentElement).toHaveClass('[&>button]:text-xs', '[&>button]:px-3');
    expect(screen.getByRole('button', { name: 'Take Down eBay' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Take Down Both' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Back To Ready/i })).not.toBeInTheDocument();
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

    fireEvent.click(await screen.findByRole('button', { name: 'Take Down Shopify' }));

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

    fireEvent.click(await screen.findByRole('button', { name: 'Take Down Shopify' }));

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

    fireEvent.click(await screen.findByRole('button', { name: 'Take Down eBay' }));

    await waitFor(() => {
      expect(takeDownWorkflowMarketplaceListingAndMoveBackMock).toHaveBeenCalledWith('rec-workflow-1', 'ebay');
      expect(loadRecords).toHaveBeenCalledWith('appApproval/table', undefined, true);
    });
  });

  it('runs both marketplace takedowns and moves the row back to ready', async () => {
    const loadRecords = vi.fn(async () => {});
    const listedRecord = buildRecord({
      'Workflow Status': 'Listed, Shopify',
      'Shopify REST Product ID': '12345',
      'eBay Offer ID': 'offer-98765',
      'eBay Listing ID': '98765',
    });
    const updatedRecord = buildRecord({ 'Workflow Status': 'Approved for Publish' });

    loadUsedGearOperationalRecordContextMock.mockResolvedValue({
      record: listedRecord,
      group: null,
    });
    takeDownWorkflowMarketplaceListingAndMoveBackMock.mockResolvedValue(updatedRecord);

    render(
      <ListingApprovalWorkflowOpsPanel
        selectedRecord={listedRecord}
        tableReference="appApproval/table"
        loadRecords={loadRecords}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Take Down Both' }));

    await waitFor(() => {
      expect(takeDownWorkflowMarketplaceListingAndMoveBackMock).toHaveBeenCalledWith('rec-workflow-1', 'both');
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

    fireEvent.click(await screen.findByRole('button', { name: 'Take Down eBay' }));

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

    expect(await screen.findByRole('button', { name: 'Take Down Shopify' })).toBeInTheDocument();
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

    expect(await screen.findByRole('button', { name: 'Take Down Shopify' })).toBeInTheDocument();
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

    fireEvent.click(await screen.findByRole('button', { name: 'Take Down Shopify' }));

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

    fireEvent.click(await screen.findByRole('button', { name: 'Take Down Shopify' }));

    await waitFor(() => {
      expect(takeDownWorkflowMarketplaceListingAndMoveBackMock).toHaveBeenCalledWith('rec-workflow-1', 'shopify');
    });

    expect(updateRecordFromResolvedSourceMock).not.toHaveBeenCalled();
  });

});
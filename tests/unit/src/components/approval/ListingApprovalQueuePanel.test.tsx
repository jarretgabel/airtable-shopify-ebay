import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ListingApprovalQueuePanel } from '@/components/approval/ListingApprovalQueuePanel';
import type { AirtableRecord } from '@/types/airtable';

function buildRecord(id: string, fields: Record<string, unknown>): AirtableRecord {
  return {
    id,
    createdTime: '2026-05-08T00:00:00.000Z',
    fields,
  };
}

const baseProps = {
  hasTableReference: true,
  error: null,
  loading: false,
  creatingShopifyListing: false,
  saving: false,
  tableReference: 'tblListings',
  tableName: 'Listings',
  approvedFieldName: 'Approved',
  shopifyRequiredFieldNames: ['Title', 'Vendor'],
  ebayRequiredFieldNames: ['Title', 'Price'],
  combinedRequiredFieldNames: ['Title'],
  titleFieldName: 'Title',
  formatFieldName: 'Format',
  priceFieldName: 'Price',
  vendorFieldName: 'Vendor',
  qtyFieldName: 'Qty',
  openRecord: vi.fn(),
  onSelectRecord: vi.fn(),
  createNewShopifyListing: vi.fn(async () => undefined),
  loadRecords: vi.fn(async () => undefined),
};

describe('ListingApprovalQueuePanel', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('filters Shopify queue rows by search query', () => {
    render(
      <ListingApprovalQueuePanel
        {...baseProps}
        approvalChannel="shopify"
        records={[
          buildRecord('1', { Title: 'McIntosh C28', Vendor: 'McIntosh', Approved: false }),
          buildRecord('2', { Title: 'Marantz 2230', Vendor: 'Marantz', Approved: false }),
        ]}
      />,
    );

    expect(screen.getByText('McIntosh C28')).toBeInTheDocument();
    expect(screen.getByText('Marantz 2230')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Search Shopify listing queue'), {
      target: { value: 'marantz' },
    });

    expect(screen.queryByText('McIntosh C28')).not.toBeInTheDocument();
    expect(screen.getByText('Marantz 2230')).toBeInTheDocument();
    expect(screen.getByText((_, node) => node?.textContent?.replace(/\s+/g, ' ').trim() === '1 of 2 listing rows shown.')).toBeInTheDocument();
  });

  it('applies quick filters on eBay queue rows', () => {
    render(
      <ListingApprovalQueuePanel
        {...baseProps}
        approvalChannel="ebay"
        records={[
          buildRecord('1', { Title: 'Ready Listing', Price: '1200', Approved: false }),
          buildRecord('2', { Title: 'Needs Price', Price: '', Approved: false }),
          buildRecord('3', { Title: 'Approved Listing', Price: '800', Approved: true }),
        ]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Needs Fields · 1' }));

    expect(screen.getByText('Needs Price')).toBeInTheDocument();
    expect(screen.queryByText('Ready Listing')).not.toBeInTheDocument();
    expect(screen.queryByText('Approved Listing')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Approved · 1' }));

    expect(screen.getByText('Approved Listing')).toBeInTheDocument();
    expect(screen.queryByText('Needs Price')).not.toBeInTheDocument();
  });

  it('defaults Shopify to pending rows and restores saved service-specific extra filters', () => {
    render(
      <ListingApprovalQueuePanel
        {...baseProps}
        approvalChannel="shopify"
        records={[
          buildRecord('1', { Title: 'Pending Active Listing', Vendor: 'McIntosh', Approved: false, Format: 'active' }),
          buildRecord('2', { Title: 'Approved Draft Listing', Vendor: 'Marantz', Approved: true, Format: 'draft' }),
        ]}
      />,
    );

    expect(screen.getByText('Pending Active Listing')).toBeInTheDocument();
    expect(screen.queryByText('Approved Draft Listing')).not.toBeInTheDocument();

    window.localStorage.setItem('approval-queue-filter:shopify:quick', 'all');
    window.localStorage.setItem('approval-queue-filter:shopify:extra', 'shopify-draft');

    render(
      <ListingApprovalQueuePanel
        {...baseProps}
        approvalChannel="shopify"
        records={[
          buildRecord('1', { Title: 'Pending Active Listing', Vendor: 'McIntosh', Approved: false, Format: 'active' }),
          buildRecord('2', { Title: 'Approved Draft Listing', Vendor: 'Marantz', Approved: true, Format: 'draft' }),
        ]}
      />,
    );

    expect(screen.getAllByText('Approved Draft Listing')[0]).toBeInTheDocument();
  });

  it('shows eBay service-specific chips when workflow or offer status fields are present', () => {
    render(
      <ListingApprovalQueuePanel
        {...baseProps}
        approvalChannel="ebay"
        records={[
          buildRecord('1', { Title: 'Live Offer Listing', Price: '950', Approved: false, 'Workflow Status': 'Listed, eBay' }),
          buildRecord('2', { Title: 'Draft Offer Listing', Price: '875', Approved: false, 'eBay Offer Status': 'draft' }),
        ]}
      />,
    );

    expect(screen.getByRole('button', { name: 'Live Offer · 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Draft Offer · 1' })).toBeInTheDocument();
  });

  it('shows the section nav and section-scoped searches for the combined queue', () => {
    render(
      <ListingApprovalQueuePanel
        {...baseProps}
        approvalChannel="combined"
        records={[
          buildRecord('1', { Title: 'Needs Review Listing', Approved: false, 'Workflow Status': 'Awaiting Pre-Listing Review' }),
          buildRecord('2', { Title: 'Approved Listing', Approved: true, Vendor: 'McIntosh', Price: '1200', 'Workflow Status': 'Approved for Publish' }),
        ]}
      />,
    );

    expect(screen.getByLabelText('Search ready for publishing combined listings')).toBeInTheDocument();
    expect(screen.getByLabelText('Search combined listings that need further work')).toBeInTheDocument();
    expect(screen.getByLabelText('Combined listings sections')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ready for Publishing' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Needs Further Work' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Needs Fields/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Refresh listing approval queue' })).toHaveLength(2);
  });

  it('splits combined rows using the same approved and readiness logic shown in the table', () => {
    render(
      <ListingApprovalQueuePanel
        {...baseProps}
        approvalChannel="combined"
        records={[
          buildRecord('1', { Title: 'Ready Listing', Approved: true, Vendor: 'McIntosh', Price: '1200', 'Workflow Status': 'Awaiting Pre-Listing Review' }),
          buildRecord('2', { Title: 'Approved Missing Vendor', Approved: true, Price: '800', 'Workflow Status': 'Approved for Publish' }),
        ]}
      />,
    );

    const readySection = document.getElementById('combined-listings-ready-for-publishing');
    const workSection = document.getElementById('combined-listings-needs-further-work');

    expect(readySection).not.toBeNull();
    expect(workSection).not.toBeNull();
    expect(within(readySection as HTMLElement).getByText('Ready Listing')).toBeInTheDocument();
    expect(within(readySection as HTMLElement).queryByText('Approved Missing Vendor')).not.toBeInTheDocument();
    expect(within(workSection as HTMLElement).getByText('Approved Missing Vendor')).toBeInTheDocument();
    expect(within(workSection as HTMLElement).queryByText('Ready Listing')).not.toBeInTheDocument();
  });
});
import { fireEvent, render, screen } from '@testing-library/react';
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

  it('does not render service quick filters for the combined queue', () => {
    render(
      <ListingApprovalQueuePanel
        {...baseProps}
        approvalChannel="combined"
        records={[buildRecord('1', { Title: 'Combined Listing', Approved: false })]}
      />,
    );

    expect(screen.queryByLabelText('Search Shopify listing queue')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Needs Fields/i })).not.toBeInTheDocument();
    expect(screen.getByText((_, node) => node?.textContent?.replace(/\s+/g, ' ').trim() === '1 listing rows loaded.')).toBeInTheDocument();
  });

  it('shows workflow-stage chips for the combined queue and filters pre-listing review rows', () => {
    render(
      <ListingApprovalQueuePanel
        {...baseProps}
        approvalChannel="combined"
        records={[
          buildRecord('1', { Title: 'Needs Review Listing', Approved: false, 'Workflow Status': 'Awaiting Pre-Listing Review' }),
          buildRecord('2', { Title: 'Approved Listing', Approved: true, 'Workflow Status': 'Approved for Publish' }),
        ]}
      />,
    );

    expect(screen.getByText('Combined Listings')).toBeInTheDocument();
    expect(screen.getByText('Listing-Phase Entry Point')).toBeInTheDocument();
    expect(screen.getByText('Listing-phase guide')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Needs Review · 1' }));

    expect(screen.getByText('Needs Review Listing')).toBeInTheDocument();
    expect(screen.queryByText('Approved Listing')).not.toBeInTheDocument();
    expect(screen.getByText((_, node) => node?.textContent?.replace(/\s+/g, ' ').trim() === '1 of 2 listing rows shown.')).toBeInTheDocument();
  });
});
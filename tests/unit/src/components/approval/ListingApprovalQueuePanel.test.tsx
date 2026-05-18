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
          buildRecord('3', { Title: 'Listed Listing', Approved: true, Vendor: 'Marantz', Price: '1300', 'Workflow Status': 'Listed, Shopify' }),
        ]}
      />,
    );

    expect(screen.getByLabelText('Search ready for publishing combined listings')).toBeInTheDocument();
    expect(screen.getByLabelText('Search active combined listings')).toBeInTheDocument();
    expect(screen.getByLabelText('Search combined listings that need further work')).toBeInTheDocument();
    expect(screen.getByLabelText('Combined listings sections')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ready for Publishing' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Active Listings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Needs Further Work' })).toBeInTheDocument();
    expect(screen.getAllByText('Workflow Status').length).toBeGreaterThan(0);
    expect(screen.queryByText('Approved')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Needs Fields/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Refresh listing approval queue' })).toHaveLength(3);
  });

  it('splits combined rows into ready, active listings, and needs-further-work sections', () => {
    render(
      <ListingApprovalQueuePanel
        {...baseProps}
        approvalChannel="combined"
        records={[
          buildRecord('1', { Title: 'Ready Listing', Approved: true, Vendor: 'McIntosh', Price: '1200', 'Workflow Status': 'Awaiting Pre-Listing Review' }),
          buildRecord('2', { Title: 'Approved Missing Vendor', Approved: true, Price: '800', 'Workflow Status': 'Approved for Publish' }),
          buildRecord('3', { Title: 'Already Listed', Approved: true, Vendor: 'Yamaha', Price: '1500', 'Workflow Status': 'Listed, eBay' }),
          buildRecord('4', { Title: 'Sold Ready Listing', Approved: true, Vendor: 'Klipsch', Price: '2400', 'Workflow Status': 'Sold - Ready to Ship' }),
          buildRecord('5', { Title: 'Shipped Listing', Approved: true, Vendor: 'Tandberg', Price: '1300', 'Workflow Status': 'Shipped' }),
        ]}
      />,
    );

    const readySection = document.getElementById('combined-listings-ready-for-publishing');
    const activeSection = document.getElementById('combined-listings-active-listings');
    const workSection = document.getElementById('combined-listings-needs-further-work');

    expect(readySection).not.toBeNull();
    expect(activeSection).not.toBeNull();
    expect(workSection).not.toBeNull();
    expect(within(readySection as HTMLElement).queryByText('Ready Listing')).not.toBeInTheDocument();
    expect(within(readySection as HTMLElement).queryByText('Sold Ready Listing')).not.toBeInTheDocument();
    expect(within(readySection as HTMLElement).queryByText('Shipped Listing')).not.toBeInTheDocument();
    expect(within(readySection as HTMLElement).queryByText('Approved Missing Vendor')).not.toBeInTheDocument();
    expect(within(readySection as HTMLElement).queryByText('Already Listed')).not.toBeInTheDocument();
    expect(within(activeSection as HTMLElement).getByText('Already Listed')).toBeInTheDocument();
    expect(within(activeSection as HTMLElement).queryByText('Ready Listing')).not.toBeInTheDocument();
    expect(within(activeSection as HTMLElement).queryByText('Sold Ready Listing')).not.toBeInTheDocument();
    expect(within(workSection as HTMLElement).getByText('Approved Missing Vendor')).toBeInTheDocument();
    expect(within(workSection as HTMLElement).getByText('Ready Listing')).toBeInTheDocument();
    expect(within(workSection as HTMLElement).getAllByText('Awaiting Pre-Listing Review').length).toBeGreaterThan(1);
    expect(within(workSection as HTMLElement).getAllByText('Approved for Publish').length).toBeGreaterThan(1);
    expect(within(workSection as HTMLElement).queryByText('Sold Ready Listing')).not.toBeInTheDocument();
    expect(within(workSection as HTMLElement).queryByText('Shipped Listing')).not.toBeInTheDocument();
    expect(within(workSection as HTMLElement).queryByText('Already Listed')).not.toBeInTheDocument();
  });

  it('keeps only approved-for-publish workflow rows in the ready-for-publishing section', () => {
    render(
      <ListingApprovalQueuePanel
        {...baseProps}
        approvalChannel="combined"
        records={[
          buildRecord('1', { Title: 'Approved Publish Row', Approved: false, Vendor: 'Rega', Price: '1800', 'Workflow Status': 'Approved for Publish' }),
          buildRecord('2', { Title: 'Sold Ready Row', Approved: true, Vendor: 'Klipsch', Price: '2400', 'Workflow Status': 'Sold - Ready to Ship' }),
          buildRecord('3', { Title: 'Shipped Row', Approved: true, Vendor: 'Tandberg', Price: '1300', 'Workflow Status': 'Shipped' }),
        ]}
      />,
    );

    const readySection = document.getElementById('combined-listings-ready-for-publishing');

    expect(readySection).not.toBeNull();
    expect(within(readySection as HTMLElement).getByText('Approved Publish Row')).toBeInTheDocument();
    expect(within(readySection as HTMLElement).getAllByText('Approved for Publish').length).toBeGreaterThan(1);
    expect(within(readySection as HTMLElement).queryByText('Sold Ready Row')).not.toBeInTheDocument();
    expect(within(readySection as HTMLElement).queryByText('Shipped Row')).not.toBeInTheDocument();
  });

  it('shows listed workflow status in the active listings section even when the raw approved field is false', () => {
    render(
      <ListingApprovalQueuePanel
        {...baseProps}
        approvalChannel="combined"
        records={[
          buildRecord('1', { Title: 'Shopify Live Row', Approved: false, Vendor: 'Thorens', Price: '1100', 'Workflow Status': 'Listed, Shopify' }),
        ]}
      />,
    );

    const activeSection = document.getElementById('combined-listings-active-listings');

    expect(activeSection).not.toBeNull();
    expect(within(activeSection as HTMLElement).getByText('Shopify Live Row')).toBeInTheDocument();
    expect(within(activeSection as HTMLElement).getAllByText('Listed, Shopify').length).toBeGreaterThan(1);
  });

  it('shows live channel status instead of needs-fields badges for already listed rows in the active section', () => {
    render(
      <ListingApprovalQueuePanel
        {...baseProps}
        approvalChannel="combined"
        records={[
          buildRecord('1', { Title: 'eBay Live Row', Approved: false, Price: '1100', 'Workflow Status': 'Listed, eBay' }),
        ]}
      />,
    );

    const activeSection = document.getElementById('combined-listings-active-listings');

    expect(activeSection).not.toBeNull();
    expect(within(activeSection as HTMLElement).getByText('eBay Live Row')).toBeInTheDocument();
    expect(within(activeSection as HTMLElement).getByText('Live')).toBeInTheDocument();
    expect(within(activeSection as HTMLElement).getByText('Not Live')).toBeInTheDocument();
    expect(within(activeSection as HTMLElement).queryByText('Needs Fields')).not.toBeInTheDocument();
  });

  it('keeps combined rows with no workflow status off the listings page', () => {
    render(
      <ListingApprovalQueuePanel
        {...baseProps}
        approvalChannel="combined"
        records={[
          buildRecord('1', { Title: 'Status Missing Row', Approved: false, Vendor: 'Test Vendor', Price: '1100' }),
        ]}
      />,
    );

    const workSection = document.getElementById('combined-listings-needs-further-work');

    expect(workSection).not.toBeNull();
    expect(within(workSection as HTMLElement).queryByText('Status Missing Row')).not.toBeInTheDocument();
    expect(screen.getByText('No combined listing rows currently need additional listing work.')).toBeInTheDocument();
  });

  it('removes sold-ready and shipped rows from the combined listings page entirely', () => {
    render(
      <ListingApprovalQueuePanel
        {...baseProps}
        approvalChannel="combined"
        records={[
          buildRecord('1', { Title: 'Sold Ready Row', Approved: true, Vendor: 'Klipsch', Price: '2400', 'Workflow Status': 'Sold - Ready to Ship' }),
          buildRecord('2', { Title: 'Shipped Row', Approved: true, Vendor: 'Tandberg', Price: '1300', 'Workflow Status': 'Shipped' }),
        ]}
      />,
    );

    expect(screen.queryByText('Sold Ready Row')).not.toBeInTheDocument();
    expect(screen.queryByText('Shipped Row')).not.toBeInTheDocument();
    expect(screen.getByText('No combined listing rows are currently ready for publishing.')).toBeInTheDocument();
    expect(screen.getByText('No combined listing rows are currently active listings.')).toBeInTheDocument();
    expect(screen.getByText('No combined listing rows currently need additional listing work.')).toBeInTheDocument();
  });

  it('keeps non-listing workflow states like Unqualified off the combined listings page', () => {
    render(
      <ListingApprovalQueuePanel
        {...baseProps}
        approvalChannel="combined"
        records={[
          buildRecord('1', { Title: 'Trash Review Row', Approved: false, 'Workflow Status': 'Unqualified' }),
        ]}
      />,
    );

    expect(screen.queryByText('Trash Review Row')).not.toBeInTheDocument();
    expect(screen.getByText('No combined listing rows are currently ready for publishing.')).toBeInTheDocument();
    expect(screen.getByText('No combined listing rows are currently active listings.')).toBeInTheDocument();
    expect(screen.getByText('No combined listing rows currently need additional listing work.')).toBeInTheDocument();
  });
});
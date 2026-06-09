import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ListingApprovalSelectedRecordPanel } from '@/components/approval/ListingApprovalSelectedRecordPanel';
import type { ListingApprovalWorkflowSummaryData } from '@/components/approval/ListingApprovalWorkflowSummary';
import type { AirtableRecord } from '@/types/airtable';

vi.mock('@/components/approval/ListingApprovalSelectedRecordView', () => ({
  ListingApprovalSelectedRecordView: () => <div>Selected Record View</div>,
}));

vi.mock('@/components/approval/ListingApprovalWorkflowSummary', () => ({
  ListingApprovalWorkflowSummary: () => <div>Workflow Summary</div>,
}));

vi.mock('@/components/approval/ListingApprovalRecordAlerts', () => ({
  ListingApprovalRecordAlerts: () => <div>Alerts</div>,
}));

vi.mock('@/components/approval/ListingApprovalRecordActions', () => ({
  ListingApprovalRecordActions: () => <div>Actions</div>,
}));

function buildSelectedRecord(): AirtableRecord {
  return {
    id: 'rec-listing-1',
    createdTime: '2026-05-15T00:00:00.000Z',
    fields: {
      Title: 'McIntosh MA6900',
      'Workflow Status': 'Awaiting Pre-Listing Review',
    },
  };
}

function buildWorkflowSummary(workflowStatus: string): ListingApprovalWorkflowSummaryData {
  return {
    workflowStatus,
    workflowNextTeam: 'Listing',
    resolvedPrice: '3499.99',
    preListingReviewedBy: '',
    timeline: [],
  };
}

describe('ListingApprovalSelectedRecordPanel', () => {
  it('wraps combined approval records in the listing-phase review shell', () => {
    render(
      <ListingApprovalSelectedRecordPanel
        selectedRecord={buildSelectedRecord()}
        titleFieldName="Title"
        eyebrowLabel="Combined Listing Editor"
        isApproved={false}
        saving={false}
        error={null}
        onBackToList={vi.fn()}
        errorSurfaceClass="rounded"
        isCombinedApproval
        workflowSummary={buildWorkflowSummary('Awaiting Pre-Listing Review')}
        workflowDetails={<div>Workflow Lifecycle Panel</div>}
        selectedRecordViewProps={{ combinedSectionsProps: {}, payloadPanelProps: {}, approvalFormFieldsProps: {} } as never}
        selectedRecordStatusProps={{ alertsProps: {}, actionsProps: {} } as never}
      />,
    );

    expect(screen.getByRole('heading', { name: 'McIntosh MA6900' })).toBeInTheDocument();
    expect(screen.getByText('Not Ready for Listings')).toBeInTheDocument();
  });

  it('leaves non-combined approval records on the plain selected-record view', () => {
    render(
      <ListingApprovalSelectedRecordPanel
        selectedRecord={buildSelectedRecord()}
        titleFieldName="Title"
        eyebrowLabel="Shopify Listing Editor"
        isApproved={false}
        saving={false}
        error={null}
        onBackToList={vi.fn()}
        errorSurfaceClass="rounded"
        isCombinedApproval={false}
        workflowSummary={null}
        workflowDetails={null}
        selectedRecordViewProps={{ combinedSectionsProps: {}, payloadPanelProps: {}, approvalFormFieldsProps: {} } as never}
        selectedRecordStatusProps={{ alertsProps: {}, actionsProps: {} } as never}
      />,
    );

    expect(screen.getByText('Not Ready for Listings')).toBeInTheDocument();
  });
});
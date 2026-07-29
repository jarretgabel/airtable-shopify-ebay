import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ListingApprovalSelectedRecordPanel } from '@/components/approval/ListingApprovalSelectedRecordPanel';
import type { ListingApprovalWorkflowSummaryData } from '@/components/approval/ListingApprovalWorkflowSummary';
import type { AirtableRecord } from '@/types/airtable';

vi.mock('@/components/approval/ListingApprovalSelectedRecordView', () => ({
  ListingApprovalSelectedRecordView: ({ editor, alerts, actions }: { editor: ReactNode; alerts: ReactNode; actions: ReactNode }) => (
    <div>
      <div>Selected Record View</div>
      {editor}
      {alerts}
      {actions}
    </div>
  ),
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

function buildSelectedRecord(workflowStatus = 'Awaiting Pre-Listing Review'): AirtableRecord {
  return {
    id: 'rec-listing-1',
    createdTime: '2026-05-15T00:00:00.000Z',
    fields: {
      Title: 'McIntosh MA6900',
      'Workflow Status': workflowStatus,
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
  it('renders the listing view for listing-phase workflow records and suppresses alerts while loading', async () => {
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
    expect(screen.getByText('Selected Record View')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Loading record editor')).toBeInTheDocument();
      expect(screen.queryByText('Alerts')).not.toBeInTheDocument();
      expect(screen.queryByText('Actions')).not.toBeInTheDocument();
    });
  });

  it('keeps non-listing workflow records on the not-ready surface', () => {
    render(
      <ListingApprovalSelectedRecordPanel
        selectedRecord={buildSelectedRecord('Testing In Progress')}
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

  it('keeps detail view visible while workflow status is temporarily unknown', () => {
    render(
      <ListingApprovalSelectedRecordPanel
        selectedRecord={buildSelectedRecord('')}
        titleFieldName="Title"
        eyebrowLabel="Combined Listing Editor"
        isApproved={false}
        saving={false}
        error={null}
        onBackToList={vi.fn()}
        errorSurfaceClass="rounded"
        isCombinedApproval
        workflowSummary={null}
        workflowDetails={null}
        selectedRecordViewProps={{ combinedSectionsProps: {}, payloadPanelProps: {}, approvalFormFieldsProps: {} } as never}
        selectedRecordStatusProps={{ alertsProps: {}, actionsProps: {} } as never}
      />,
    );

    expect(screen.queryByText('Not Ready for Listings')).not.toBeInTheDocument();
    expect(screen.getByText('Selected Record View')).toBeInTheDocument();
  });
});

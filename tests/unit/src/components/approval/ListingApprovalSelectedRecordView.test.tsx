import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ListingApprovalSelectedRecordView } from '@/components/approval/ListingApprovalSelectedRecordView';

describe('ListingApprovalSelectedRecordView', () => {
  it('gates payload panels behind explicit expansion', () => {
    render(
      <ListingApprovalSelectedRecordView
        selectedRecord={{
          id: 'rec-approval-1',
          createdTime: '2026-04-30T00:00:00.000Z',
          fields: { Title: 'Sansui AU-919' },
        }}
        titleFieldName="Title"
        eyebrowLabel="Shopify Listing Editor"
        isApproved={false}
        saving={false}
        error={null}
        onBackToList={vi.fn()}
        secondaryActionButtonClass="rounded"
        errorSurfaceClass="rounded"
        workflowSummary={null}
        editor={<div>Editor</div>}
        alerts={<div>Alerts</div>}
        actions={<div>Actions</div>}
        payloadPanels={<div>Deferred Payload Preview</div>}
      />,
    );

    expect(screen.getByText('Shopify Listing Editor')).toBeInTheDocument();
    expect(screen.queryByText('Deferred Payload Preview')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('API Payload Previews'));

    expect(screen.getByText('Deferred Payload Preview')).toBeInTheDocument();
  });

  it('renders workflow review context when provided', () => {
    render(
      <ListingApprovalSelectedRecordView
        selectedRecord={{
          id: 'rec-approval-2',
          createdTime: '2026-04-30T00:00:00.000Z',
          fields: { Title: 'Accuphase E-470' },
        }}
        titleFieldName="Title"
        eyebrowLabel="Combined Listing Editor"
        isApproved
        saving={false}
        error={null}
        onBackToList={vi.fn()}
        secondaryActionButtonClass="rounded"
        errorSurfaceClass="rounded"
        workflowSummary={(
          <div>
            <div>Workflow Review Context</div>
            <div>Resolved Price</div>
            <div>2499.00</div>
          </div>
        )}
        editor={<div>Editor</div>}
        alerts={<div>Alerts</div>}
        actions={<div>Actions</div>}
        payloadPanels={<div>Deferred Payload Preview</div>}
      />,
    );

    expect(screen.getByText('Combined Listing Editor')).toBeInTheDocument();
    expect(screen.getByText('Workflow Review Context')).toBeInTheDocument();
    expect(screen.getByText('Resolved Price')).toBeInTheDocument();
    expect(screen.getByText('2499.00')).toBeInTheDocument();
  });
});
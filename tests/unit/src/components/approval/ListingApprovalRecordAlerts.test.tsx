import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ListingApprovalRecordAlerts } from '@/components/approval/ListingApprovalRecordAlerts';

const baseProps = {
  approvalChannel: 'combined' as const,
  workflowStatus: 'Awaiting Pre-Listing Review',
  workflowReadinessMissingRequirements: [] as string[],
  hasUnsavedChanges: false,
  changedFieldNames: [],
  hasMissingShopifyRequiredFields: false,
  missingShopifyRequiredFieldNames: [],
  missingShopifyRequiredFieldLabels: [],
  hasMissingEbayRequiredFields: false,
  missingEbayRequiredFieldNames: [],
  missingEbayRequiredFieldLabels: [],
  inlineActionNotices: [],
  fadingInlineNoticeIds: [],
};

describe('ListingApprovalRecordAlerts', () => {
  it('shows pre-listing review guidance when readiness blockers are cleared', () => {
    render(<ListingApprovalRecordAlerts {...baseProps} />);

    expect(screen.getByText('Listing review is in progress.')).toBeInTheDocument();
    expect(screen.getByText(/approve the row for publish/i)).toBeInTheDocument();
  });

  it('shows workflow readiness blockers for pre-listing review rows', () => {
    render(
      <ListingApprovalRecordAlerts
        {...baseProps}
        workflowReadinessMissingRequirements={['Capture a listing price before approving the row for publish.']}
      />,
    );

    expect(screen.getByText('Resolve listing readiness blockers before approving for publish.')).toBeInTheDocument();
    expect(screen.getByText(/Capture a listing price/i)).toBeInTheDocument();
  });
});
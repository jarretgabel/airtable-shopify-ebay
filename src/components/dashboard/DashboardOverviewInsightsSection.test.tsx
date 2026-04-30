import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DashboardOverviewSection } from '@/components/dashboard/DashboardOverviewInsightsSection';

describe('DashboardOverviewSection', () => {
  it('renders degraded KPI cards as unavailable and blocks navigation', () => {
    const onSelectTab = vi.fn();

    render(
      <DashboardOverviewSection
        jfLoading={false}
        jotformUnavailableReason="Missing public runtime config: VITE_JOTFORM_FORM_ID."
        jfSubmissionCount={5}
        thisWeekCount={2}
        recentCount={4}
        totalNewSubmissions={1}
        spLoading={false}
        draftCount={3}
        activeCount={7}
        archivedCount={1}
        nonEmptyListingCount={12}
        approvalPending={6}
        approvalApproved={10}
        approvalTotal={16}
        approvalUnavailableReason="Missing public runtime config: VITE_AIRTABLE_APPROVAL_TABLE_REF."
        uniqueAirtableBrands={5}
        uniqueAirtableTypes={4}
        ebayPublishedCount={8}
        ebayDraftCount={2}
        ebayTotal={10}
        ebayUnavailableReason="Missing public runtime config: VITE_EBAY_AUTH_HOST."
        sellThroughPct={30}
        submissionsTrend={{ direction: 'flat', text: 'Flat' }}
        dealsTrend={{ direction: 'flat', text: 'Flat' }}
        acquisitionTrend={{ direction: 'flat', text: 'Flat' }}
        inventoryTrend={{ direction: 'flat', text: 'Flat' }}
        salesTrend={{ direction: 'flat', text: 'Flat' }}
        marginTrend={{ direction: 'flat', text: 'Flat' }}
        onSelectTab={onSelectTab}
      />,
    );

    expect(screen.getAllByText('Unavailable').length).toBeGreaterThanOrEqual(3);

    const jotformButton = screen.getByRole('button', { name: /incoming gear submissions/i });
    const approvalButton = screen.getByRole('button', { name: /approval queue/i });
    const ebayButton = screen.getByRole('button', { name: /ebay coverage/i });
    const shopifyButton = screen.getByRole('button', { name: /deals in progress/i });

    expect(jotformButton).toBeDisabled();
    expect(approvalButton).toBeDisabled();
    expect(ebayButton).toBeDisabled();
    expect(shopifyButton).toBeEnabled();

    fireEvent.click(jotformButton);
    fireEvent.click(approvalButton);
    fireEvent.click(ebayButton);
    fireEvent.click(shopifyButton);

    expect(onSelectTab).toHaveBeenCalledTimes(1);
    expect(onSelectTab).toHaveBeenCalledWith('shopify');
    expect(screen.getAllByText('Off').length).toBeGreaterThanOrEqual(3);
  });
});
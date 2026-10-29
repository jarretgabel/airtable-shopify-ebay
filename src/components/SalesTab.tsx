import { useMemo } from 'react';
import { canViewFinance, hasFullAccessRole, isDeveloperRole } from '@/auth/roleAccess';
import type { UserRole } from '@/stores/auth/authTypes';
import { AppPageLayout } from '@/components/app/AppPageLayout';
import { WorkflowPageHeader } from '@/components/app/WorkflowPageHeader';
import { DashboardBuyersSection } from '@/components/dashboard/DashboardBuyersSection';
import { DashboardFinanceSection } from '@/components/dashboard/DashboardFinanceSection';
import { DashboardReportsSection } from '@/components/dashboard/DashboardReportsSection';
import { DashboardSectionNav } from '@/components/dashboard/DashboardSectionNav';
import { buildDashboardSections } from '@/components/dashboard/dashboardTabHelpers';
import { useDashboardSectionTracking } from '@/components/dashboard/useDashboardSectionTracking';

export function SalesTab({ currentUserRole }: { currentUserRole: UserRole }) {
  const showWarnings = isDeveloperRole(currentUserRole);
  const finance = canViewFinance(currentUserRole);
  const reports = hasFullAccessRole(currentUserRole);
  const sections = useMemo(
    () => buildDashboardSections({
      includeOverview: false,
      showActionsSection: false,
      showInsightsSection: false,
      showFinanceSection: finance,
      showBuyersSection: finance,
      showReportsSection: reports,
    }),
    [finance, reports],
  );
  const { activeSectionId, scrollToSection } = useDashboardSectionTracking(sections);

  return (
    <AppPageLayout className="[overflow-anchor:none]">
      <WorkflowPageHeader eyebrow="Business" title="Sales" />
      <DashboardSectionNav sections={sections} activeSectionId={activeSectionId} onSelectSection={scrollToSection} />
      {finance ? <DashboardFinanceSection showWarnings={showWarnings} /> : null}
      {finance ? <DashboardBuyersSection showWarnings={showWarnings} /> : null}
      {reports ? <DashboardReportsSection showWarnings={showWarnings} /> : null}
    </AppPageLayout>
  );
}

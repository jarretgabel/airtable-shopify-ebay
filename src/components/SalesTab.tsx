import { useMemo } from 'react';
import { LoadingSurface } from '@/components/app/StateSurfaces';
import { useSectionLoadTracker } from '@/components/dashboard/useSectionLoadTracker';
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
  const expectedSections = useMemo(
    () => [...(finance ? ['finance', 'buyers'] : []), ...(reports ? ['reports'] : [])],
    [finance, reports],
  );
  const { allLoaded, reporter } = useSectionLoadTracker(expectedSections);
  const { activeSectionId, scrollToSection } = useDashboardSectionTracking(sections);

  return (
    <AppPageLayout className="[overflow-anchor:none]">
      <WorkflowPageHeader eyebrow="Business" title="Sales" />
      {expectedSections.length > 0 && !allLoaded ? <LoadingSurface message="Loading sales..." /> : (
        <DashboardSectionNav sections={sections} activeSectionId={activeSectionId} onSelectSection={scrollToSection} />
      )}
      <div className={allLoaded ? 'contents' : 'hidden'}>
        {finance ? <DashboardFinanceSection showWarnings={showWarnings} onLoadedChange={reporter('finance')} /> : null}
        {finance ? <DashboardBuyersSection showWarnings={showWarnings} onLoadedChange={reporter('buyers')} /> : null}
        {reports ? <DashboardReportsSection showWarnings={showWarnings} onLoadedChange={reporter('reports')} /> : null}
      </div>
    </AppPageLayout>
  );
}

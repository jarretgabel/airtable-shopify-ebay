import { useMemo } from 'react';
import { hasFullAccessRole, isDeveloperRole } from '@/auth/roleAccess';
import type { UserRole } from '@/stores/auth/authTypes';
import { AppPageLayout } from '@/components/app/AppPageLayout';
import { WorkflowPageHeader } from '@/components/app/WorkflowPageHeader';
import { DashboardCustomersSection } from '@/components/dashboard/DashboardCustomersSection';
import { DashboardSectionNav } from '@/components/dashboard/DashboardSectionNav';
import { DashboardSellersSection } from '@/components/dashboard/DashboardSellersSection';
import { buildDashboardSections } from '@/components/dashboard/dashboardTabHelpers';
import { useDashboardSectionTracking } from '@/components/dashboard/useDashboardSectionTracking';

export function PeopleTab({ currentUserRole }: { currentUserRole: UserRole }) {
  const showWarnings = isDeveloperRole(currentUserRole);
  const fullAccess = hasFullAccessRole(currentUserRole);
  const sections = useMemo(
    () => buildDashboardSections({
      includeOverview: false,
      showActionsSection: false,
      showInsightsSection: false,
      showSellersSection: fullAccess,
      showCustomersSection: fullAccess,
    }),
    [fullAccess],
  );
  const { activeSectionId, scrollToSection } = useDashboardSectionTracking(sections);

  return (
    <AppPageLayout className="[overflow-anchor:none]">
      <WorkflowPageHeader eyebrow="Business" title="People" />
      <DashboardSectionNav sections={sections} activeSectionId={activeSectionId} onSelectSection={scrollToSection} />
      {fullAccess ? <DashboardSellersSection showWarnings={showWarnings} /> : null}
      {fullAccess ? <DashboardCustomersSection showWarnings={showWarnings} /> : null}
    </AppPageLayout>
  );
}

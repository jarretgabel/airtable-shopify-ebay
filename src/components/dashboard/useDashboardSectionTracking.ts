import { usePageSectionTracking } from '@/components/app/usePageSectionTracking';
import type { DashboardSection, DashboardSectionId } from '@/components/dashboard/dashboardTabTypes';

interface DashboardSectionTracking {
  activeSectionId: DashboardSectionId;
  scrollToSection: (sectionId: string) => void;
}

export function useDashboardSectionTracking(sections: DashboardSection[]): DashboardSectionTracking {
  const { activeSectionId, scrollToSection } = usePageSectionTracking(sections, 'overview');
  return { activeSectionId: activeSectionId as DashboardSectionId, scrollToSection };
}

import { MainPageSectionNav } from '@/components/app/MainPageSectionNav';

interface DashboardSectionLink {
  id: string;
  label: string;
}

interface DashboardSectionNavProps {
  sections: DashboardSectionLink[];
  activeSectionId: string;
  onSelectSection: (sectionId: string) => void;
}

export function DashboardSectionNav({ sections, activeSectionId, onSelectSection }: DashboardSectionNavProps) {
  return (
    <MainPageSectionNav
      ariaLabel="Dashboard sections"
      items={sections.map((section) => ({ key: section.id, label: section.label }))}
      activeKey={activeSectionId}
      onSelect={onSelectSection}
    />
  );
}

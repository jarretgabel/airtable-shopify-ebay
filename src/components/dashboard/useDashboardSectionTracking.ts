import { useEffect, useState } from 'react';
import type { DashboardSection, DashboardSectionId } from '@/components/dashboard/dashboardTabTypes';

interface DashboardSectionTracking {
  activeSectionId: DashboardSectionId;
  scrollToSection: (sectionId: string) => void;
}

export function useDashboardSectionTracking(sections: DashboardSection[]): DashboardSectionTracking {
  const [activeSectionId, setActiveSectionId] = useState<DashboardSectionId>(sections[0]?.id ?? 'overview');

  useEffect(() => {
    setActiveSectionId((current) => (sections.some((section) => section.id === current) ? current : sections[0]?.id ?? 'overview'));
  }, [sections]);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.id) setActiveSectionId(visible.target.id as DashboardSectionId);
      },
      { rootMargin: '-15% 0px -60% 0px', threshold: [0.2, 0.35, 0.5] },
    );

    sections.forEach((section) => {
      const element = document.getElementById(section.id);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, [sections]);

  function scrollToSection(sectionId: string) {
    const element = document.getElementById(sectionId);
    if (!element) return;

    const top = element.getBoundingClientRect().top + window.scrollY - 88;
    window.scrollTo({ top, behavior: 'smooth' });
  }

  return {
    activeSectionId,
    scrollToSection,
  };
}
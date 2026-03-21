import { useEffect, useRef, useState } from 'react';
import type { DashboardSection, DashboardSectionId } from '@/components/dashboard/dashboardTabTypes';

interface DashboardSectionTracking {
  activeSectionId: DashboardSectionId;
  scrollToSection: (sectionId: string) => void;
}

// Fraction of viewport height at which a section is considered "active" as it
// scrolls into view. 0.25 = 25% from the top of the viewport.
const TRIGGER_RATIO = 0.25;

export function useDashboardSectionTracking(sections: DashboardSection[]): DashboardSectionTracking {
  const [activeSectionId, setActiveSectionId] = useState<DashboardSectionId>(sections[0]?.id ?? 'overview');
  // Suppresses passive scroll tracking while a click-triggered smooth scroll
  // is still animating so the nav highlight doesn't flicker.
  const scrollLockRef = useRef(false);
  const lockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    setActiveSectionId((current) => (sections.some((s) => s.id === current) ? current : sections[0]?.id ?? 'overview'));
  }, [sections]);

  // Passive scroll listener: find the last section whose top has crossed the
  // trigger line. Works correctly for sections of any height.
  useEffect(() => {
    function computeActive(): DashboardSectionId | null {
      const triggerY = window.scrollY + window.innerHeight * TRIGGER_RATIO;
      let found: DashboardSectionId | null = null;
      for (const section of sections) {
        const el = document.getElementById(section.id);
        if (!el) continue;
        const absTop = el.getBoundingClientRect().top + window.scrollY;
        if (absTop <= triggerY) found = section.id;
      }
      return found;
    }

    function onScroll() {
      if (scrollLockRef.current) return;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const id = computeActive();
        if (id) setActiveSectionId(id);
      });
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [sections]);

  useEffect(() => {
    return () => {
      if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
    };
  }, []);

  function scrollToSection(sectionId: string) {
    const element = document.getElementById(sectionId);
    if (!element) return;

    // Set the active state immediately and suppress passive tracking while the
    // smooth scroll animation plays out.
    setActiveSectionId(sectionId as DashboardSectionId);
    scrollLockRef.current = true;
    if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
    lockTimerRef.current = setTimeout(() => {
      scrollLockRef.current = false;
    }, 800);

    const top = element.getBoundingClientRect().top + window.scrollY - 88;
    window.scrollTo({ top, behavior: 'smooth' });
  }

  return { activeSectionId, scrollToSection };
}

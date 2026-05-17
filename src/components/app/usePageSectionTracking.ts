import { useEffect, useRef, useState } from 'react';

interface TrackableSection {
  id: string;
}

interface PageSectionTracking {
  activeSectionId: string;
  scrollToSection: (sectionId: string) => void;
}

const TRIGGER_RATIO = 0.25;

export function usePageSectionTracking(sections: TrackableSection[], fallbackSectionId: string): PageSectionTracking {
  const [activeSectionId, setActiveSectionId] = useState<string>(sections[0]?.id ?? fallbackSectionId);
  const scrollLockRef = useRef(false);
  const lockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    setActiveSectionId((current) => (sections.some((section) => section.id === current) ? current : sections[0]?.id ?? fallbackSectionId));
  }, [fallbackSectionId, sections]);

  useEffect(() => {
    function computeActive(): string | null {
      const triggerY = window.scrollY + window.innerHeight * TRIGGER_RATIO;
      let found: string | null = null;

      for (const section of sections) {
        const element = document.getElementById(section.id);
        if (!element) {
          continue;
        }

        const absTop = element.getBoundingClientRect().top + window.scrollY;
        if (absTop <= triggerY) {
          found = section.id;
        }
      }

      return found;
    }

    function onScroll() {
      if (scrollLockRef.current) {
        return;
      }

      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }

      rafRef.current = requestAnimationFrame(() => {
        const nextSectionId = computeActive();
        if (nextSectionId) {
          setActiveSectionId(nextSectionId);
        }
      });
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [sections]);

  useEffect(() => () => {
    if (lockTimerRef.current) {
      clearTimeout(lockTimerRef.current);
    }
  }, []);

  function scrollToSection(sectionId: string) {
    const element = document.getElementById(sectionId);
    if (!element) {
      return;
    }

    setActiveSectionId(sectionId);
    scrollLockRef.current = true;
    if (lockTimerRef.current) {
      clearTimeout(lockTimerRef.current);
    }

    lockTimerRef.current = setTimeout(() => {
      scrollLockRef.current = false;
    }, 800);

    const top = element.getBoundingClientRect().top + window.scrollY - 88;
    window.scrollTo({ top, behavior: 'smooth' });
  }

  return { activeSectionId, scrollToSection };
}
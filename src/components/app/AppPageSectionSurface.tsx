import type { ComponentPropsWithoutRef, ReactNode } from 'react';

interface AppPageSectionSurfaceProps extends ComponentPropsWithoutRef<'section'> {
  children: ReactNode;
}

export function AppPageSectionSurface({ children, className, ...sectionProps }: AppPageSectionSurfaceProps) {
  return (
    <section
      {...sectionProps}
      className={`rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-5 ${className ?? ''}`.trim()}
    >
      {children}
    </section>
  );
}
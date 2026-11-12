import type { ComponentPropsWithoutRef, ReactNode } from 'react';

interface AppPageSectionSurfaceProps extends ComponentPropsWithoutRef<'section'> {
  children: ReactNode;
}

export function AppPageSectionSurface({ children, className, ...sectionProps }: AppPageSectionSurfaceProps) {
  return (
    <section
      {...sectionProps}
      className={`rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[0_1px_2px_rgba(2,6,23,0.12),0_8px_24px_rgba(2,6,23,0.06)] ${className ?? ''}`.trim()}
    >
      {children}
    </section>
  );
}
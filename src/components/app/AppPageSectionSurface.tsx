import type { ComponentPropsWithoutRef, ReactNode } from 'react';

interface AppPageSectionSurfaceProps extends ComponentPropsWithoutRef<'section'> {
  children: ReactNode;
  /** Drops the card chrome so content sits directly on the page. */
  flat?: boolean;
}

export function AppPageSectionSurface({ children, className, flat, ...sectionProps }: AppPageSectionSurfaceProps) {
  return (
    <section
      {...sectionProps}
      {...(flat ? { 'data-flat-section': '' } : {})}
      className={`${flat ? '' : 'rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-5'} ${className ?? ''}`.trim()}
    >
      {children}
    </section>
  );
}
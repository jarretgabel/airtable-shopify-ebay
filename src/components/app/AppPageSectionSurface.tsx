import type { ReactNode } from 'react';

interface AppPageSectionSurfaceProps {
  children: ReactNode;
  className?: string;
}

export function AppPageSectionSurface({ children, className }: AppPageSectionSurfaceProps) {
  return (
    <section className={`rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-5 ${className ?? ''}`.trim()}>
      {children}
    </section>
  );
}
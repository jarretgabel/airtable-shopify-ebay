import type { ReactNode } from 'react';

interface AppPageLayoutProps {
  children: ReactNode;
  className?: string;
}

export function AppPageLayout({ children, className }: AppPageLayoutProps) {
  return (
    <div className={`mx-auto flex w-full max-w-6xl flex-col gap-6 ${className ?? ''}`.trim()}>
      {children}
    </div>
  );
}
import type { ReactNode } from 'react';
import { emptySurfaceClass, errorSurfaceClass, loadingSurfaceClass, panelSurfaceClass, spinnerClass } from '@/components/tabs/uiClasses';

export function PanelSurface({ children }: { children: ReactNode }) {
  return <section className={panelSurfaceClass}>{children}</section>;
}

export function ErrorSurface({ title, message, children }: { title: string; message: string; children?: ReactNode }) {
  return (
    <section className={errorSurfaceClass}>
      <p className="m-0 font-bold text-[var(--error-text)]">{title}</p>
      <p className="mt-2 text-[var(--error-text)]/85">{message}</p>
      {children}
    </section>
  );
}

export function LoadingSurface({ message }: { message: string }) {
  return (
    <section className={loadingSurfaceClass}>
      <div className={spinnerClass} />
      <p>{message}</p>
    </section>
  );
}

export function EmptySurface({ title, message }: { title: string; message: string }) {
  return (
    <section className={emptySurfaceClass}>
      <p className="m-0 font-bold text-[var(--ink)]">{title}</p>
      <p>{message}</p>
    </section>
  );
}

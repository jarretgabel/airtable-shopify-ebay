import type { SelectHTMLAttributes } from 'react';

interface ApprovalSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  selectClassName: string;
}

export function ApprovalSelect({ selectClassName, children, ...selectProps }: ApprovalSelectProps) {
  return (
    <div className="relative">
      <select className={selectClassName} {...selectProps}>
        {children}
      </select>
      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[var(--muted)]">
        <svg aria-hidden="true" viewBox="0 0 12 8" className="h-2 w-2" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M1 1.5L6 6.5L11 1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </div>
  );
}

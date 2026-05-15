import type { ButtonHTMLAttributes } from 'react';

interface FilterToggleIconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  expanded: boolean;
  collapsedLabel: string;
  expandedLabel: string;
}

export function FilterToggleIconButton({
  expanded,
  collapsedLabel,
  expandedLabel,
  className,
  type = 'button',
  ...buttonProps
}: FilterToggleIconButtonProps) {
  const label = expanded ? expandedLabel : collapsedLabel;

  return (
    <button
      {...buttonProps}
      type={type}
      aria-label={label}
      title={label}
      className={[
        'inline-flex h-10 w-10 items-center justify-center rounded-xl border bg-[var(--bg)] text-[var(--muted)] shadow-[0_4px_14px_rgba(17,32,49,0.04)] transition hover:-translate-y-0.5 hover:bg-[var(--line)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0',
        expanded
          ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]'
          : 'border-[var(--line)] hover:border-sky-300 hover:text-[var(--ink)]',
        className ?? '',
      ].join(' ').trim()}
    >
      <span className="sr-only">{label}</span>
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
        <path d="M3.333 5.417h13.334" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        <path d="M6.25 10h7.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        <path d="M8.75 14.583h2.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        <circle cx="5.417" cy="5.417" r="1.25" fill="currentColor" />
        <circle cx="10" cy="10" r="1.25" fill="currentColor" />
        <circle cx="12.5" cy="14.583" r="1.25" fill="currentColor" />
      </svg>
    </button>
  );
}
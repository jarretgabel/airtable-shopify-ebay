import type { ButtonHTMLAttributes } from 'react';

interface CopyLinkIconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  label: string;
  copied?: boolean;
  copying?: boolean;
  copiedLabel?: string;
  copyingLabel?: string;
}

export function CopyLinkIconButton({
  label,
  copied = false,
  copying = false,
  copiedLabel,
  copyingLabel,
  className,
  disabled,
  type = 'button',
  ...buttonProps
}: CopyLinkIconButtonProps) {
  const accessibleLabel = copying
    ? (copyingLabel ?? label)
    : copied
      ? (copiedLabel ?? label)
      : label;

  return (
    <button
      {...buttonProps}
      type={type}
      disabled={disabled}
      aria-label={accessibleLabel}
      title={accessibleLabel}
      className={[
        'inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--bg)] text-[var(--muted)] shadow-[0_4px_14px_rgba(17,32,49,0.04)] transition hover:-translate-y-0.5 hover:border-sky-300 hover:bg-[var(--line)] hover:text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0',
        copied ? 'border-emerald-400/60 text-emerald-200' : '',
        className ?? '',
      ].join(' ').trim()}
    >
      <span className="sr-only">{accessibleLabel}</span>
      {copying ? (
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4 animate-spin">
          <path d="M10 3.333a6.667 6.667 0 1 1-4.714 1.953" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M3.333 3.333v3.334h3.334" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : copied ? (
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
          <path d="M4.167 10.417 7.5 13.75 15.833 5.417" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
          <rect x="7.25" y="4.75" width="8" height="10" rx="2" stroke="currentColor" strokeWidth="1.6" />
          <path d="M5.75 12.25h-.5A2.25 2.25 0 0 1 3 10V6.25A2.25 2.25 0 0 1 5.25 4h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}
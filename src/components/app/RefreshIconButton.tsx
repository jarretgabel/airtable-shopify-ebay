import type { ButtonHTMLAttributes } from 'react';

interface RefreshIconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  label: string;
  loading?: boolean;
  loadingLabel?: string;
}

export function RefreshIconButton({
  label,
  loading = false,
  loadingLabel,
  className,
  disabled,
  type = 'button',
  ...buttonProps
}: RefreshIconButtonProps) {
  const accessibleLabel = loading ? (loadingLabel ?? label) : label;

  return (
    <button
      {...buttonProps}
      type={type}
      disabled={disabled}
      aria-label={accessibleLabel}
      title={accessibleLabel}
      className={[
        'inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--bg)] text-[var(--muted)] shadow-[0_4px_14px_rgba(17,32,49,0.04)] transition hover:-translate-y-0.5 hover:border-sky-300 hover:bg-[var(--line)] hover:text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0',
        className ?? '',
      ].join(' ').trim()}
    >
      <span className="sr-only">{accessibleLabel}</span>
      <svg
        viewBox="0 0 20 20"
        fill="none"
        aria-hidden="true"
        className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`.trim()}
      >
        <path
          d="M16.667 10A6.667 6.667 0 0 1 5.283 14.717"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M16.667 6.667V3.333h-3.334"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M3.333 10A6.667 6.667 0 0 1 14.717 5.283"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M3.333 13.333v3.334h3.334"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
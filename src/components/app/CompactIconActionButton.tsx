interface CompactIconActionButtonProps {
  label: string;
  onClick: () => void;
  variant?: 'compact-primary' | 'compact-secondary' | 'small-secondary';
  icon?: 'open' | 'group';
}

const variantClassNames: Record<NonNullable<CompactIconActionButtonProps['variant']>, string> = {
  'compact-primary': 'inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--accent)]/20 bg-[var(--accent)]/8 text-[var(--ink)] transition hover:border-[var(--accent)]/35 hover:bg-[var(--accent)]/12 disabled:cursor-not-allowed disabled:opacity-60',
  'compact-secondary': 'inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--panel)]/80 text-[var(--ink)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition hover:border-[var(--accent)]/45 hover:bg-[var(--panel)] disabled:cursor-not-allowed disabled:opacity-60',
  'small-secondary': 'inline-flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--bg)] text-[var(--muted)] transition hover:border-[var(--accent)] hover:bg-[var(--line)] hover:text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-60',
};

export function CompactIconActionButton({
  label,
  onClick,
  variant = 'compact-secondary',
  icon = 'open',
}: CompactIconActionButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={variantClassNames[variant]}
      onClick={onClick}
    >
      {icon === 'group' ? (
        <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5">
          <path d="M7.083 10a2.083 2.083 0 0 1 0-4.167h2.084" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          <path d="M12.917 10A2.083 2.083 0 0 0 12.917 5.833H10.833" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          <path d="M7.083 14.167A2.083 2.083 0 0 1 7.083 10h2.084" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          <path d="M12.917 14.167A2.083 2.083 0 0 0 12.917 10H10.833" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
      ) : (
        <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5">
          <path d="M7.5 12.5 12.5 7.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M8.333 6.667h5v5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}
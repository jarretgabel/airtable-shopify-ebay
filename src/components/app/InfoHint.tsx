interface InfoHintProps {
  text: string;
  label?: string;
  className?: string;
  tooltipClassName?: string;
}

export function InfoHint({
  text,
  label = 'More information',
  className,
  tooltipClassName,
}: InfoHintProps) {
  return (
    <span className={`group relative inline-flex ${className ?? ''}`.trim()}>
      <button
        type="button"
        className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--bg)] text-[0.72rem] font-bold leading-none text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
        aria-label={label}
        title={text}
      >
        i
      </button>
      <span
        role="tooltip"
        className={[
          'pointer-events-none absolute left-0 top-[calc(100%+0.5rem)] z-20 w-72 max-w-[min(18rem,calc(100vw-2rem))] rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-left text-xs font-medium leading-5 text-[var(--ink)] opacity-0 shadow-[0_18px_40px_rgba(2,6,23,0.28)] transition duration-150 group-hover:opacity-100 group-focus-within:opacity-100',
          tooltipClassName ?? '',
        ].join(' ').trim()}
      >
        {text}
      </span>
    </span>
  );
}
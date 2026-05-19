import type { ButtonHTMLAttributes, ReactNode } from 'react';

export const toolbarIconButtonClassName = 'inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--bg)] text-[var(--muted)] shadow-[0_4px_14px_rgba(17,32,49,0.04)] transition hover:-translate-y-0.5 hover:border-sky-300 hover:bg-[var(--line)] hover:text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0';

interface ToolbarIconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  label: string;
  icon: ReactNode;
}

export function ToolbarIconButton({
  label,
  icon,
  className,
  type = 'button',
  ...buttonProps
}: ToolbarIconButtonProps) {
  return (
    <button
      {...buttonProps}
      type={type}
      aria-label={label}
      title={label}
      className={[
        toolbarIconButtonClassName,
        className ?? '',
      ].join(' ').trim()}
    >
      <span className="sr-only">{label}</span>
      {icon}
    </button>
  );
}
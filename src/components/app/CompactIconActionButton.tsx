import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from 'react';
import { toolbarIconButtonClassName } from '@/components/app/ToolbarIconButton';

interface CompactIconActionButtonBaseProps {
  label: string;
  variant?: 'compact-primary' | 'compact-secondary' | 'small-secondary' | 'toolbar-secondary';
  icon?: 'open' | 'group' | 'check' | 'truck' | 'form' | 'edit' | 'eye';
  disabled?: boolean;
}

interface CompactIconActionButtonLinkProps extends CompactIconActionButtonBaseProps, Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'children'> {
  href: string;
  onClick?: AnchorHTMLAttributes<HTMLAnchorElement>['onClick'];
}

interface CompactIconActionButtonButtonProps extends CompactIconActionButtonBaseProps, Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  href?: undefined;
  onClick: NonNullable<ButtonHTMLAttributes<HTMLButtonElement>['onClick']>;
}

export type CompactIconActionButtonProps = CompactIconActionButtonLinkProps | CompactIconActionButtonButtonProps;

export interface CompactActionIconProps {
  icon?: NonNullable<CompactIconActionButtonProps['icon']>;
  className?: string;
}

const variantClassNames: Record<NonNullable<CompactIconActionButtonProps['variant']>, string> = {
  'compact-primary': 'inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--accent)]/20 bg-[var(--accent)]/8 text-[var(--ink)] transition hover:border-[var(--accent)]/35 hover:bg-[var(--accent)]/12 disabled:cursor-not-allowed disabled:opacity-60',
  'compact-secondary': 'inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--panel)]/80 text-[var(--ink)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition hover:border-[var(--accent)]/45 hover:bg-[var(--panel)] disabled:cursor-not-allowed disabled:opacity-60',
  'small-secondary': 'inline-flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--bg)] text-[var(--muted)] transition hover:border-[var(--accent)] hover:bg-[var(--line)] hover:text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-60',
  'toolbar-secondary': toolbarIconButtonClassName,
};

export function CompactActionIcon({ icon = 'open', className = 'h-3.5 w-3.5' }: CompactActionIconProps) {
  return icon === 'group' ? (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className={className}>
      <path d="M7.083 10a2.083 2.083 0 0 1 0-4.167h2.084" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M12.917 10A2.083 2.083 0 0 0 12.917 5.833H10.833" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M7.083 14.167A2.083 2.083 0 0 1 7.083 10h2.084" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M12.917 14.167A2.083 2.083 0 0 0 12.917 10H10.833" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  ) : icon === 'check' ? (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className={className}>
      <path d="m5.833 10.417 2.5 2.5 5.834-5.834" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) : icon === 'truck' ? (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className={className}>
      <path d="M2.917 5.833h8.75v6.25h-8.75z" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11.667 8.333h2.291l1.875 1.875v1.875h-4.166" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.417 14.583a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5Z" stroke="currentColor" strokeWidth="1.75" />
      <path d="M14.583 14.583a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5Z" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  ) : icon === 'form' ? (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className={className}>
      <path d="M6.25 3.75h5.833l2.5 2.5v10H6.25z" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12.083 3.75v2.5h2.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.333 9.167h4.167" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M8.333 12.5h4.167" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  ) : icon === 'edit' ? (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className={className}>
      <path d="M4.167 15.833h2.5l7.083-7.083-2.5-2.5-7.083 7.083v2.5Z" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m10.833 6.667 2.5 2.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.167 15.833h11.666" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  ) : icon === 'eye' ? (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className={className}>
      <path d="M2.5 10c0 0 3-5.5 7.5-5.5s7.5 5.5 7.5 5.5-3 5.5-7.5 5.5S2.5 10 2.5 10Z" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  ) : (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className={className}>
      <path d="M7.5 12.5 12.5 7.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.333 6.667h5v5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CompactIconActionButton({
  label,
  variant = 'compact-secondary',
  icon = 'open',
  disabled = false,
  ...props
}: CompactIconActionButtonProps) {
  const iconClassName = variant === 'toolbar-secondary' ? 'h-4 w-4' : 'h-3.5 w-3.5';

  if ('href' in props && typeof props.href === 'string') {
    const { href, onClick, ...anchorProps } = props;

    return (
      <a
        {...anchorProps}
        href={href}
        aria-label={label}
        title={label}
        className={variantClassNames[variant]}
        onClick={onClick}
      >
        <CompactActionIcon icon={icon} className={iconClassName} />
      </a>
    );
  }

  const { onClick, type = 'button', ...buttonProps } = props;

  return (
    <button
      {...buttonProps}
      type={type}
      aria-label={label}
      title={label}
      className={variantClassNames[variant]}
      onClick={onClick}
      disabled={disabled}
    >
      {icon ? <CompactActionIcon icon={icon} className={iconClassName} /> : <span className="px-2 text-sm font-medium">{label}</span>}
    </button>
  );
}
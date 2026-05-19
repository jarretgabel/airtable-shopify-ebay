import type { AnchorHTMLAttributes } from 'react';
import { OpenLinkToolbarIcon } from '@/components/app/OpenLinkToolbarIcon';
import { toolbarIconButtonClassName } from '@/components/app/ToolbarIconButton';

interface OpenLinkToolbarButtonProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'children' | 'href'> {
  label: string;
  href: string;
}

function normalizeExternalHref(href: string): string {
  const normalizedHref = href.trim();
  if (!normalizedHref) {
    return normalizedHref;
  }

  return /^https?:\/\//i.test(normalizedHref) ? normalizedHref : `https://${normalizedHref}`;
}

export function OpenLinkToolbarButton({ label, href, className, target = '_blank', rel, ...anchorProps }: OpenLinkToolbarButtonProps) {
  const normalizedHref = normalizeExternalHref(href);

  return (
    <a
      {...anchorProps}
      href={normalizedHref}
      aria-label={label}
      title={label}
      target={target}
      rel={rel ?? 'noreferrer noopener'}
      className={[
        toolbarIconButtonClassName,
        className ?? '',
      ].join(' ').trim()}
    >
      <span className="sr-only">{label}</span>
      <OpenLinkToolbarIcon />
    </a>
  );
}
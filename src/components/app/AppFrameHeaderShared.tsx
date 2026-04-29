import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react';
import type { AppTab, OpenDropdown } from '@/components/app/appFrameTypes';

export function tabClassName(active: boolean): string {
  const base =
    'relative inline-flex items-center justify-center whitespace-nowrap px-4 py-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-55';
  if (active) {
    return `${base} text-[var(--accent)] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:rounded-full after:bg-[var(--accent)]`;
  }
  return `${base} text-[var(--muted)] hover:text-[var(--ink)]`;
}

export function handleDropdownTriggerKeyDown(
  event: ReactKeyboardEvent<HTMLButtonElement>,
  target: Exclude<OpenDropdown, null>,
  onToggleDropdown: (next: Exclude<OpenDropdown, null>) => void,
  onCloseDropdowns: () => void,
) {
  if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    onToggleDropdown(target);
  }
  if (event.key === 'Escape') {
    onCloseDropdowns();
  }
}

export function TabBadge({ count }: { count?: number }): ReactNode {
  if (typeof count !== 'number' || count <= 0) return null;

  return (
    <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[0.65rem] font-bold leading-none text-white">
      {count}
    </span>
  );
}

export function TabButton({ tab }: { tab: AppTab }): ReactNode {
  return (
    <button type="button" className={tabClassName(tab.active)} disabled={tab.disabled} onClick={tab.onClick}>
      {tab.label}
      <TabBadge count={tab.badgeCount} />
    </button>
  );
}

export function DropdownTabList({
  tabs,
  onSelect,
  autoFocusFirst,
}: {
  tabs: AppTab[];
  onSelect: (tab: AppTab) => void;
  autoFocusFirst?: boolean;
}): ReactNode {
  const firstEnabledIndex = autoFocusFirst ? tabs.findIndex((tab) => !tab.disabled) : -1;
  return (
    <>
      {tabs.map((tab, index) => (
        <button
          key={tab.key}
          autoFocus={index === firstEnabledIndex}
          role="menuitem"
          type="button"
          disabled={tab.disabled}
          onClick={() => onSelect(tab)}
          className={[
            'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-semibold transition',
            tab.active
              ? 'bg-sky-500/15 text-sky-200'
              : 'text-[var(--muted)] hover:bg-white/5 hover:text-[var(--ink)]',
            tab.disabled ? 'cursor-not-allowed opacity-60' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <span>{tab.label}</span>
          <TabBadge count={tab.badgeCount} />
        </button>
      ))}
    </>
  );
}

export function DropdownTrigger({
  active,
  expanded,
  label,
  menuId,
  badgeCount,
  onClick,
  onKeyDown,
}: {
  active: boolean;
  expanded: boolean;
  label: string;
  menuId: string;
  badgeCount?: number;
  onClick: () => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLButtonElement>) => void;
}): ReactNode {
  return (
    <button
      type="button"
      aria-haspopup="menu"
      aria-controls={menuId}
      aria-expanded={expanded}
      onClick={onClick}
      onKeyDown={onKeyDown}
      className={tabClassName(active || expanded)}
    >
      <span className="inline-flex items-center gap-1.5">
        {label}
        <TabBadge count={badgeCount} />
        <span className={`text-[0.72rem] transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden="true">▾</span>
      </span>
    </button>
  );
}
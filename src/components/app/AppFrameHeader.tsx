import type { ReactNode, Ref } from 'react';
import { accentActionButtonClass, primaryActionButtonClass, secondaryActionButtonClass } from '@/components/app/buttonStyles';
import type { AppTab, OpenDropdown } from '@/components/app/appFrameTypes';

interface AppFrameHeaderProps {
  headerRef: Ref<HTMLElement>;
  currentUserLabel: string;
  tabs: AppTab[];
  postEbayTabs: AppTab[];
  ebayTabs: AppTab[];
  utilityTabs: AppTab[];
  refreshLabel: string;
  refreshDisabled: boolean;
  onRefresh: () => void;
  exportDisabled: boolean;
  onExportCurrentPage: () => void;
  onExportAllPages: () => void;
  onLogout: () => void;
  openDropdown: OpenDropdown;
  onToggleDropdown: (next: Exclude<OpenDropdown, null>) => void;
  onCloseDropdowns: () => void;
}

function tabClassName(active: boolean): string {
  const base =
    'relative inline-flex items-center justify-center whitespace-nowrap px-4 py-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-55';
  if (active) {
    return `${base} text-[var(--accent)] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:rounded-full after:bg-[var(--accent)]`;
  }
  return `${base} text-[var(--muted)] hover:text-[var(--ink)]`;
}

function TabBadge({ count }: { count?: number }): ReactNode {
  if (typeof count !== 'number' || count <= 0) return null;

  return (
    <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[0.65rem] font-bold leading-none text-white">
      {count}
    </span>
  );
}

function TabButton({ tab }: { tab: AppTab }): ReactNode {
  return (
    <button type="button" className={tabClassName(tab.active)} disabled={tab.disabled} onClick={tab.onClick}>
      {tab.label}
      <TabBadge count={tab.badgeCount} />
    </button>
  );
}

function DropdownTabList({
  tabs,
  onSelect,
}: {
  tabs: AppTab[];
  onSelect: (tab: AppTab) => void;
}): ReactNode {
  return (
    <>
      {tabs.map((tab) => (
        <button
          key={tab.key}
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

function DropdownTrigger({
  active,
  expanded,
  label,
  onClick,
}: {
  active: boolean;
  expanded: boolean;
  label: string;
  onClick: () => void;
}): ReactNode {
  return (
    <button type="button" aria-haspopup="menu" aria-expanded={expanded} onClick={onClick} className={tabClassName(active || expanded)}>
      <span className="inline-flex items-center gap-1.5">
        {label}
        <span className={`text-[0.72rem] transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden="true">▾</span>
      </span>
    </button>
  );
}

export function AppFrameHeader({
  headerRef,
  currentUserLabel,
  tabs,
  postEbayTabs,
  ebayTabs,
  utilityTabs,
  refreshLabel,
  refreshDisabled,
  onRefresh,
  exportDisabled,
  onExportCurrentPage,
  onExportAllPages,
  onLogout,
  openDropdown,
  onToggleDropdown,
  onCloseDropdowns,
}: AppFrameHeaderProps): ReactNode {
  const hasActiveEbayTab = ebayTabs.some((tab) => tab.active);
  const hasActiveUtilityTab = utilityTabs.some((tab) => tab.active);

  return (
    <header ref={headerRef} className="relative z-40 border-b border-[var(--line)] bg-[rgba(7,17,28,0.85)] backdrop-blur-md">
      <div className="mx-auto flex w-[min(1200px,96vw)] items-center justify-between gap-4 py-3">
        <div>
          <span className="text-[0.6rem] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">Inventory Operations</span>
          <h1 className="m-0 text-[1rem] font-bold leading-none text-[var(--ink)]">Listing Control Center</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2" data-export-ignore="true">
          <span className="hidden rounded-full border border-[var(--line)] px-3 py-1 text-[0.78rem] text-[var(--muted)] sm:inline">{currentUserLabel}</span>
          <button type="button" onClick={onRefresh} disabled={refreshDisabled} className={primaryActionButtonClass}>{refreshLabel}</button>
          <div className="relative" data-export-ignore="true">
            <button
              type="button"
              onClick={() => !exportDisabled && onToggleDropdown('pdf')}
              aria-haspopup="menu"
              aria-expanded={openDropdown === 'pdf'}
              className={`${accentActionButtonClass} ${exportDisabled ? 'pointer-events-none opacity-60' : ''}`}
            >
              <span className="inline-flex items-center gap-1.5">
                Download PDF
                <span className={`text-[0.72rem] transition-transform ${openDropdown === 'pdf' ? 'rotate-180' : ''}`} aria-hidden="true">▾</span>
              </span>
            </button>
            {openDropdown === 'pdf' && (
              <div className="absolute right-0 top-[calc(100%+0.45rem)] z-[70] min-w-[230px] rounded-xl border border-[var(--line)] bg-[var(--panel)] p-1.5 shadow-[0_14px_28px_rgba(2,6,23,0.35)]">
                <button type="button" disabled={exportDisabled} onClick={() => { onCloseDropdowns(); onExportCurrentPage(); }} className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-semibold text-[var(--ink)] transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60">Download Current Page</button>
                <button type="button" disabled={exportDisabled} onClick={() => { onCloseDropdowns(); onExportAllPages(); }} className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-semibold text-[var(--ink)] transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60">Download All Pages</button>
              </div>
            )}
          </div>
          <button type="button" onClick={onLogout} className={secondaryActionButtonClass}>Log Out</button>
        </div>
      </div>

      <nav className="mx-auto w-[min(1200px,96vw)]" aria-label="Main navigation">
        <div className="relative flex flex-wrap items-end gap-1">
          <div className="flex min-w-0 flex-1 items-end gap-1">
            {tabs.map((tab) => <TabButton key={tab.key} tab={tab} />)}

            {ebayTabs.length > 0 && (
              <div className="relative flex-shrink-0" data-export-ignore="true">
                <DropdownTrigger
                  active={hasActiveEbayTab}
                  expanded={openDropdown === 'ebay'}
                  label="eBay"
                  onClick={() => onToggleDropdown('ebay')}
                />
                {openDropdown === 'ebay' && (
                  <div className="absolute left-0 top-[calc(100%+0.45rem)] z-[70] min-w-[280px] rounded-xl border border-[var(--line)] bg-[var(--panel)] p-1.5 shadow-[0_14px_28px_rgba(2,6,23,0.35)]">
                    <DropdownTabList tabs={ebayTabs} onSelect={(tab) => { onCloseDropdowns(); tab.onClick(); }} />
                  </div>
                )}
              </div>
            )}

            {postEbayTabs.map((tab) => <TabButton key={tab.key} tab={tab} />)}
          </div>

          {utilityTabs.length > 0 && (
            <div className="relative flex-shrink-0" data-export-ignore="true">
              <DropdownTrigger
                active={hasActiveUtilityTab}
                expanded={openDropdown === 'utilities'}
                label="Utilities"
                onClick={() => onToggleDropdown('utilities')}
              />
              {openDropdown === 'utilities' && (
                <div className="absolute right-0 top-[calc(100%+0.45rem)] z-[70] min-w-[240px] rounded-xl border border-[var(--line)] bg-[var(--panel)] p-1.5 shadow-[0_14px_28px_rgba(2,6,23,0.35)]">
                  <DropdownTabList tabs={utilityTabs} onSelect={(tab) => { onCloseDropdowns(); tab.onClick(); }} />
                </div>
              )}
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}
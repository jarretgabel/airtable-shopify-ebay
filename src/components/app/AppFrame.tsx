import { ReactNode, Ref, useEffect, useRef, useState } from 'react';
import { AppPage } from '@/auth/pages';
import { accentActionButtonClass, primaryActionButtonClass, secondaryActionButtonClass } from '@/components/app/buttonStyles';

interface AppTab {
  key: AppPage;
  label: string;
  active: boolean;
  badgeCount?: number;
  disabled?: boolean;
  onClick: () => void;
}

interface ExportProgress {
  current: number;
  total: number;
  label: string;
}

interface AppFrameProps {
  shellRef?: Ref<HTMLElement>;
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
  exportProgress: ExportProgress | null;
  exporting: boolean;
  children: ReactNode;
}

function tabClassName(active: boolean): string {
  const base = 'relative inline-flex items-center justify-center whitespace-nowrap px-4 py-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-55';
  if (active) {
    return `${base} text-[var(--accent)] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:rounded-full after:bg-[var(--accent)]`;
  }
  return `${base} text-[var(--muted)] hover:text-[var(--ink)]`;
}

type OpenDropdown = 'pdf' | 'ebay' | 'utilities' | null;

export function AppFrame({
  shellRef,
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
  exportProgress,
  exporting,
  children,
}: AppFrameProps) {
  const hasActiveEbayTab = ebayTabs.some((tab) => tab.active);
  const hasActiveUtilityTab = utilityTabs.some((tab) => tab.active);
  const [openDropdown, setOpenDropdown] = useState<OpenDropdown>(null);
  const shellContainerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!shellContainerRef.current) return;
      if (!(event.target instanceof Node)) return;
      if (!shellContainerRef.current.contains(event.target)) {
        setOpenDropdown(null);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, []);

  function toggleDropdown(next: Exclude<OpenDropdown, null>) {
    setOpenDropdown((current) => current === next ? null : next);
  }

  function closeDropdowns() {
    setOpenDropdown(null);
  }

  return (
    <main
      ref={shellRef}
      className={[
        'dashboard-dark min-h-screen text-[var(--ink)]',
        '[--bg:#07111c] [--ink:#e8f1fb] [--muted:#92a7be] [--panel:#101a28] [--line:#25384b] [--accent:#68a4ff] [--error-bg:#37181d] [--error-text:#ffcdc7]',
        exporting ? 'cursor-progress' : '',
      ].filter(Boolean).join(' ')}
    >
      {/* Top bar */}
      <header ref={shellContainerRef} className="relative z-40 border-b border-[var(--line)] bg-[rgba(7,17,28,0.85)] backdrop-blur-md">
        <div className="mx-auto flex w-[min(1200px,96vw)] items-center justify-between gap-4 py-3">
          <div>
            <span className="text-[0.6rem] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">Inventory Operations</span>
            <h1 className="m-0 text-[1rem] font-bold leading-none text-[var(--ink)]">Listing Control Center</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2" data-export-ignore="true">
            <span className="hidden rounded-full border border-[var(--line)] px-3 py-1 text-[0.78rem] text-[var(--muted)] sm:inline">
              {currentUserLabel}
            </span>
            <button type="button" onClick={onRefresh} disabled={refreshDisabled} className={primaryActionButtonClass}>
              {refreshLabel}
            </button>
            <div className="relative" data-export-ignore="true">
              <button
                type="button"
                onClick={() => {
                  if (exportDisabled) return;
                  toggleDropdown('pdf');
                }}
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
                  <button
                    type="button"
                    disabled={exportDisabled}
                    onClick={() => {
                      closeDropdowns();
                      onExportCurrentPage();
                    }}
                    className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-semibold text-[var(--ink)] transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Download Current Page
                  </button>
                  <button
                    type="button"
                    disabled={exportDisabled}
                    onClick={() => {
                      closeDropdowns();
                      onExportAllPages();
                    }}
                    className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-semibold text-[var(--ink)] transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Download All Pages
                  </button>
                </div>
              )}
            </div>
            <button type="button" onClick={onLogout} className={secondaryActionButtonClass}>
              Log Out
            </button>
          </div>
        </div>

        {/* Full-width tab strip */}
        <nav className="mx-auto w-[min(1200px,96vw)]" aria-label="Main navigation">
          <div className="relative flex flex-wrap items-end gap-1">
            <div className="flex min-w-0 flex-1 items-end gap-1">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className={tabClassName(tab.active)}
                  disabled={tab.disabled}
                  onClick={tab.onClick}
                >
                  {tab.label}
                  {typeof tab.badgeCount === 'number' && tab.badgeCount > 0 && (
                    <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[0.65rem] font-bold leading-none text-white">
                      {tab.badgeCount}
                    </span>
                  )}
                </button>
              ))}

              {ebayTabs.length > 0 && (
                <div className="relative flex-shrink-0" data-export-ignore="true">
                  <button
                    type="button"
                    aria-haspopup="menu"
                    aria-expanded={openDropdown === 'ebay'}
                    onClick={() => toggleDropdown('ebay')}
                    className={tabClassName(hasActiveEbayTab || openDropdown === 'ebay')}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      eBay
                      <span className={`text-[0.72rem] transition-transform ${openDropdown === 'ebay' ? 'rotate-180' : ''}`} aria-hidden="true">▾</span>
                    </span>
                  </button>
                  {openDropdown === 'ebay' && (
                    <div className="absolute left-0 top-[calc(100%+0.45rem)] z-[70] min-w-[280px] rounded-xl border border-[var(--line)] bg-[var(--panel)] p-1.5 shadow-[0_14px_28px_rgba(2,6,23,0.35)]">
                      {ebayTabs.map((tab) => (
                        <button
                          key={tab.key}
                          type="button"
                          disabled={tab.disabled}
                          onClick={() => {
                            closeDropdowns();
                            tab.onClick();
                          }}
                          className={[
                            'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-semibold transition',
                            tab.active
                              ? 'bg-sky-500/15 text-sky-200'
                              : 'text-[var(--muted)] hover:bg-white/5 hover:text-[var(--ink)]',
                            tab.disabled ? 'cursor-not-allowed opacity-60' : '',
                          ].filter(Boolean).join(' ')}
                        >
                          <span>{tab.label}</span>
                          {typeof tab.badgeCount === 'number' && (
                            <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[0.65rem] font-bold leading-none text-white">
                              {tab.badgeCount}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {postEbayTabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className={tabClassName(tab.active)}
                  disabled={tab.disabled}
                  onClick={tab.onClick}
                >
                  {tab.label}
                  {typeof tab.badgeCount === 'number' && tab.badgeCount > 0 && (
                    <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[0.65rem] font-bold leading-none text-white">
                      {tab.badgeCount}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {utilityTabs.length > 0 && (
              <div className="relative flex-shrink-0" data-export-ignore="true">
                <button
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={openDropdown === 'utilities'}
                  onClick={() => toggleDropdown('utilities')}
                  className={tabClassName(hasActiveUtilityTab || openDropdown === 'utilities')}
                >
                  <span className="inline-flex items-center gap-1.5">
                    Utilities
                    <span className={`text-[0.72rem] transition-transform ${openDropdown === 'utilities' ? 'rotate-180' : ''}`} aria-hidden="true">▾</span>
                  </span>
                </button>
                {openDropdown === 'utilities' && (
                  <div className="absolute right-0 top-[calc(100%+0.45rem)] z-[70] min-w-[240px] rounded-xl border border-[var(--line)] bg-[var(--panel)] p-1.5 shadow-[0_14px_28px_rgba(2,6,23,0.35)]">
                    {utilityTabs.map((tab) => (
                      <button
                        key={tab.key}
                        type="button"
                        disabled={tab.disabled}
                        onClick={() => {
                          closeDropdowns();
                          tab.onClick();
                        }}
                        className={[
                          'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-semibold transition',
                          tab.active
                            ? 'bg-sky-500/15 text-sky-200'
                            : 'text-[var(--muted)] hover:bg-white/5 hover:text-[var(--ink)]',
                          tab.disabled ? 'cursor-not-allowed opacity-60' : '',
                        ].filter(Boolean).join(' ')}
                      >
                        <span>{tab.label}</span>
                        {typeof tab.badgeCount === 'number' && (
                          <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[0.65rem] font-bold leading-none text-white">
                            {tab.badgeCount}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </nav>
      </header>

      {/* Page content */}
      <section className="mx-auto w-[min(1200px,96vw)] py-6 sm:py-8">
        {exportProgress && (
          <div className="fixed inset-0 z-40 grid place-items-center bg-slate-950/65 p-6 backdrop-blur-sm" data-export-ignore="true">
            <div className="w-full max-w-[480px] rounded-[28px] border border-sky-400/20 bg-[radial-gradient(circle_at_top,rgba(37,99,235,0.2),transparent_58%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.96))] p-7 shadow-[0_28px_70px_rgba(2,6,23,0.48)]">
              <p className="mb-2 text-[0.72rem] uppercase tracking-[0.22em] text-sky-300">Preparing PDF export</p>
              <h2 className="text-[clamp(1.5rem,2.2vw,2rem)] font-semibold leading-[1.05] text-slate-50">{exportProgress.label}</h2>
              <p className="mt-3 leading-6 text-slate-300">
                Capturing screen {exportProgress.current} of {exportProgress.total} and adding it to a single PDF.
              </p>
              <div className="mt-5 h-2.5 overflow-hidden rounded-full border border-slate-400/15 bg-slate-800/90">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-blue-500 to-sky-400 shadow-[0_0_24px_rgba(56,189,248,0.35)] transition-[width] duration-200 ease-out"
                  style={{ width: `${Math.round((exportProgress.current / exportProgress.total) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {children}
      </section>
    </main>
  );
}

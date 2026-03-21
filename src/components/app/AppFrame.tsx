import { ReactNode, Ref } from 'react';
import { AppPage } from '@/auth/pages';
import { accentActionButtonClass, primaryActionButtonClass, secondaryActionButtonClass } from '@/components/app/buttonStyles';

interface AppStat {
  label: string;
  value: ReactNode;
}

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
  stats: AppStat[];
  tabs: AppTab[];
  heroMeta: ReactNode;
  refreshLabel: string;
  refreshDisabled: boolean;
  onRefresh: () => void;
  exportLabel: string;
  exportDisabled: boolean;
  onExport: () => void;
  onLogout: () => void;
  exportProgress: ExportProgress | null;
  exporting: boolean;
  children: ReactNode;
}

function tabClassName(active: boolean): string {
  const base = 'inline-flex items-center justify-center whitespace-nowrap rounded-[10px] px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-55';
  if (active) {
    return `${base} bg-gradient-to-r from-[var(--accent)] to-blue-500 text-white`;
  }

  return `${base} bg-transparent text-[var(--muted)] hover:bg-white/6 hover:text-[var(--ink)]`;
}

export function AppFrame({
  shellRef,
  currentUserLabel,
  stats,
  tabs,
  heroMeta,
  refreshLabel,
  refreshDisabled,
  onRefresh,
  exportLabel,
  exportDisabled,
  onExport,
  onLogout,
  exportProgress,
  exporting,
  children,
}: AppFrameProps) {
  return (
    <main
      ref={shellRef}
      className={[
        'dashboard-dark min-h-screen bg-[radial-gradient(circle_at_90%_-10%,rgba(104,164,255,0.22),transparent_38%),radial-gradient(circle_at_10%_0%,rgba(46,208,195,0.18),transparent_34%),linear-gradient(180deg,#050c14,#09131f_32%,#07111c_100%)] text-[var(--ink)]',
        '[--bg:#07111c] [--ink:#e8f1fb] [--muted:#92a7be] [--panel:#101a28] [--line:#25384b] [--accent:#68a4ff] [--error-bg:#37181d] [--error-text:#ffcdc7]',
        exporting ? 'cursor-progress' : '',
      ].filter(Boolean).join(' ')}
    >
      <section className="mx-auto w-[min(1100px,94vw)] px-0 py-8 sm:py-10">
        <header className="grid gap-4 rounded-[18px] bg-[linear-gradient(135deg,#08111d,#12233a_62%,#20569e)] p-6 text-slate-50 shadow-[0_24px_48px_rgba(0,0,0,0.35)] md:grid-cols-[2fr_1fr]">
          <div>
            <p className="m-0 text-xs font-semibold uppercase tracking-[0.16em] text-slate-200/85">Inventory Operations</p>
            <h1 className="mt-2 text-[clamp(1.7rem,3.6vw,2.5rem)] font-semibold leading-[1.1]">Listing Control Center</h1>
            <p className="mt-3 max-w-[56ch] text-slate-200/85">Monitor your Airtable inventory and Shopify product catalog in one place.</p>
          </div>
          <div className="self-start rounded-xl border border-white/15 bg-[rgba(7,17,28,0.55)] p-4">
            {heroMeta}
          </div>
        </header>

        <section className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {stats.map((stat) => (
            <article key={stat.label} className="rounded-2xl border border-[var(--line)] bg-[linear-gradient(180deg,rgba(16,26,40,0.98),rgba(11,20,31,0.98))] px-4 py-4 shadow-[0_18px_36px_rgba(0,0,0,0.2)]">
              <p className="m-0 text-[0.77rem] uppercase tracking-[0.08em] text-[var(--muted)]">{stat.label}</p>
              <p className="mt-1 text-2xl font-bold">{stat.value}</p>
            </article>
          ))}
        </section>

        <div className="mt-[1.1rem] flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-1.5 rounded-xl border border-[var(--line)] bg-[linear-gradient(180deg,rgba(16,26,40,0.98),rgba(11,20,31,0.98))] p-1.5 shadow-[0_18px_36px_rgba(0,0,0,0.2)]">
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
                  <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[0.72rem] font-bold leading-none text-white">
                    {tab.badgeCount}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3" data-export-ignore="true">
            <span className="rounded-full border border-[var(--line)] bg-[var(--panel)] px-3 py-1.5 text-[0.82rem] text-[var(--muted)]">
              {currentUserLabel}
            </span>
            <button type="button" onClick={onRefresh} disabled={refreshDisabled} className={primaryActionButtonClass}>
              {refreshLabel}
            </button>
            <button type="button" onClick={onExport} disabled={exportDisabled} className={accentActionButtonClass}>
              {exportLabel}
            </button>
            <button type="button" onClick={onLogout} className={secondaryActionButtonClass}>
              Log Out
            </button>
          </div>
        </div>

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

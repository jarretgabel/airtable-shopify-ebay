import type { DashboardTargetTab } from './dashboardTabTypes';

const sectionBaseClass = 'scroll-mt-24';
const sectionHeaderClass = 'mb-4 flex items-center border-b border-[var(--line)] pb-3 pt-1';
const sectionHeaderLabelClass = 'm-0 text-[1.05rem] font-semibold text-[var(--ink)]';

interface StatTileProps {
  label: string;
  value: number | string;
  loading?: boolean;
  accent?: string;
}

function StatTile({ label, value, loading, accent = 'border-t-slate-500' }: StatTileProps) {
  return (
    <div className={`flex flex-col gap-1 rounded-[12px] border border-[var(--line)] border-t-[3px] ${accent} bg-[var(--panel)] px-4 py-3 shadow-[0_1px_3px_rgba(17,32,49,0.06)]`}>
      <span className="text-[0.7rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">{label}</span>
      <span className="text-[1.55rem] font-bold leading-none tracking-[-0.02em] text-[var(--ink)]">
        {loading ? '…' : value}
      </span>
    </div>
  );
}

interface ActionItemProps {
  label: string;
  count: number;
  detail: string;
  severity: 'critical' | 'warning' | 'info';
  targetTab: DashboardTargetTab;
  onSelectTab: (tab: DashboardTargetTab) => void;
}

const severityClass = {
  critical: 'border-red-500/30 bg-red-950/25 text-red-300 hover:border-red-400/50',
  warning: 'border-amber-500/30 bg-amber-950/25 text-amber-300 hover:border-amber-400/50',
  info: 'border-blue-500/30 bg-blue-950/25 text-blue-300 hover:border-blue-400/50',
} as const;

const severityCountClass = {
  critical: 'bg-red-900/50 text-red-200',
  warning: 'bg-amber-900/50 text-amber-200',
  info: 'bg-blue-900/50 text-blue-200',
} as const;

function ActionItem({ label, count, detail, severity, targetTab, onSelectTab }: ActionItemProps) {
  return (
    <button
      type="button"
      className={`flex w-full items-start gap-3 rounded-[12px] border px-4 py-3.5 text-left transition hover:-translate-y-px ${severityClass[severity]}`}
      onClick={() => onSelectTab(targetTab)}
    >
      <span className={`mt-0.5 shrink-0 rounded-full px-2.5 py-0.5 text-[0.75rem] font-bold tabular-nums ${severityCountClass[severity]}`}>
        {count}
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[0.88rem] font-semibold leading-snug">{label}</span>
        <span className="text-[0.78rem] opacity-75">{detail}</span>
      </div>
      <span className="ml-auto shrink-0 self-center text-[0.75rem] font-semibold opacity-60">Go →</span>
    </button>
  );
}

export interface DashboardListingsModuleProps {
  spLoading: boolean;
  ebayLoading: boolean;
  ebayAuthenticated: boolean;
  activeProductsCount: number;
  draftProductsCount: number;
  archivedProductsCount: number;
  ebayPublishedCount: number;
  ebayDraftCount: number;
  ebayTotal: number;
  onSelectTab: (tab: DashboardTargetTab) => void;
}

export function DashboardListingsModule({
  spLoading,
  ebayLoading,
  ebayAuthenticated,
  activeProductsCount,
  draftProductsCount,
  archivedProductsCount,
  ebayPublishedCount,
  ebayDraftCount,
  ebayTotal,
  onSelectTab,
}: DashboardListingsModuleProps) {
  const actionItems: ActionItemProps[] = [];

  if (draftProductsCount > 0) {
    actionItems.push({
      label: `${draftProductsCount} listing${draftProductsCount === 1 ? '' : 's'} awaiting approval`,
      count: draftProductsCount,
      detail: `${activeProductsCount} active · ${archivedProductsCount} archived`,
      severity: 'critical',
      targetTab: 'shopify-approval',
      onSelectTab,
    });
  }

  if (ebayAuthenticated && ebayDraftCount > 0) {
    actionItems.push({
      label: `${ebayDraftCount} eBay draft${ebayDraftCount === 1 ? '' : 's'} ready to publish`,
      count: ebayDraftCount,
      detail: `${ebayPublishedCount} currently live · ${ebayTotal} total tracked SKUs`,
      severity: 'warning',
      targetTab: 'ebay',
      onSelectTab,
    });
  }

  return (
    <section id="listing-status" className={`${sectionBaseClass} flex flex-col gap-6`}>
      {/* Listing Stats */}
      <div className="rounded-[14px] border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[0_1px_3px_rgba(17,32,49,0.06),0_4px_14px_rgba(17,32,49,0.05)]">
        <div className={sectionHeaderClass}>
          <h2 className={sectionHeaderLabelClass}>Listing Status</h2>
        </div>

        <div className="flex flex-col gap-4">
          {/* Shopify */}
          <div>
            <p className="mb-2 text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Shopify</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <StatTile label="Active" value={activeProductsCount} loading={spLoading} accent="border-t-emerald-500" />
              <StatTile label="Draft" value={draftProductsCount} loading={spLoading} accent="border-t-amber-500" />
              <StatTile label="Archived" value={archivedProductsCount} loading={spLoading} accent="border-t-slate-500" />
              <StatTile label="Total" value={activeProductsCount + draftProductsCount + archivedProductsCount} loading={spLoading} accent="border-t-blue-500" />
            </div>
          </div>

          {/* eBay */}
          <div>
            <p className="mb-2 text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">eBay</p>
            {!ebayAuthenticated ? (
              <p className="rounded-[10px] border border-[var(--line)] bg-white/5 px-4 py-3 text-[0.82rem] text-[var(--muted)]">
                Connect eBay to see live stats.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <StatTile label="Published" value={ebayPublishedCount} loading={ebayLoading} accent="border-t-green-500" />
                <StatTile label="Unpublished" value={ebayDraftCount} loading={ebayLoading} accent="border-t-yellow-500" />
                <StatTile label="Total SKUs" value={ebayTotal} loading={ebayLoading} accent="border-t-sky-500" />
              </div>
            )}
          </div>

          {/* Shopify Queue */}
          <div>
            <p className="mb-2 text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Shopify Queue</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatTile label="Pending" value={draftProductsCount} loading={spLoading} accent="border-t-red-500" />
              <StatTile label="Active" value={activeProductsCount} loading={spLoading} accent="border-t-emerald-500" />
              <StatTile label="Total" value={activeProductsCount + draftProductsCount + archivedProductsCount} loading={spLoading} accent="border-t-slate-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Actions Needed */}
      <div className="rounded-[14px] border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[0_1px_3px_rgba(17,32,49,0.06),0_4px_14px_rgba(17,32,49,0.05)]">
        <div className={sectionHeaderClass}>
          <h2 className={sectionHeaderLabelClass}>Actions Needed</h2>
        </div>

        {actionItems.length === 0 ? (
          <div className="flex items-center gap-3 rounded-[12px] border border-emerald-500/25 bg-emerald-950/20 px-4 py-4 text-[0.88rem] text-emerald-300">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <span>All clear — no actions required right now.</span>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {actionItems.map((item) => (
              <ActionItem key={item.targetTab} {...item} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

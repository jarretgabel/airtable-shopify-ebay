import type { AppPage } from '@/auth/pages';
import { DashboardSubPanel } from '@/components/dashboard/dashboardPrimitives';
import type { DashboardTargetTab } from '@/components/dashboard/dashboardTabTypes';
import type { UsedGearWorkflowAnalyticsSnapshot } from '@/services/usedGearWorkflowAnalytics';

interface StageRow {
  label: string;
  count: number;
  tab?: DashboardTargetTab;
  tone: string;
}

type Counts = UsedGearWorkflowAnalyticsSnapshot['statusCounts'];

function sum(counts: Counts, ...statuses: Array<keyof Counts>): number {
  return statuses.reduce((total, status) => total + (counts[status] ?? 0), 0);
}

/** Active products grouped by workflow stage, in the order they move through the process. Trash is excluded. */
export function getStageRows(counts: Counts): StageRow[] {
  return [
    { label: 'Pending review', count: sum(counts, 'Pending Review'), tab: 'manual-intake', tone: 'bg-slate-400' },
    { label: 'Awaiting arrival', count: sum(counts, 'Accepted - Awaiting Arrival'), tab: 'parking-lot', tone: 'bg-indigo-400' },
    { label: 'Awaiting SKU / missing item', count: sum(counts, 'Accepted - Arrived, Awaiting SKU', 'Accepted - Arrived, Awaiting Missing Item'), tab: 'inventory', tone: 'bg-violet-400' },
    { label: 'Testing', count: sum(counts, 'Testing In Progress'), tab: 'testing-queue', tone: 'bg-blue-400' },
    { label: 'Photography', count: sum(counts, 'Photography In Progress'), tab: 'photography-queue', tone: 'bg-sky-400' },
    { label: 'Ready to list', count: sum(counts, 'Awaiting Pre-Listing Review', 'Approved for Publish'), tab: 'listings', tone: 'bg-teal-400' },
    { label: 'Listed', count: sum(counts, 'Listed, Shopify', 'Listed, eBay'), tab: 'post-publish', tone: 'bg-emerald-400' },
    { label: 'Stale listings', count: sum(counts, 'Stale Listing, Shopify', 'Stale Listing, eBay'), tab: 'post-publish', tone: 'bg-amber-400' },
    { label: 'Sold, ready to ship', count: sum(counts, 'Sold - Ready to Ship'), tab: 'post-publish', tone: 'bg-orange-400' },
    { label: 'Shipped', count: sum(counts, 'Shipped'), tab: 'archive', tone: 'bg-green-500' },
  ];
}

export function DashboardStageBreakdown({
  counts,
  accessiblePages,
  onSelectTab,
}: {
  counts: Counts;
  accessiblePages: AppPage[];
  onSelectTab: (tab: DashboardTargetTab) => void;
}) {
  const rows = getStageRows(counts);
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  if (total === 0) return null;
  const max = Math.max(...rows.map((row) => row.count), 1);

  return (
    <DashboardSubPanel title={<>Products by stage <span className="text-[0.78rem] font-medium text-[var(--muted)]">{total.toLocaleString()} active</span></>}>
      <ul className="m-0 grid list-none gap-1 p-0">
        {rows.map((row) => {
          const target = row.tab && accessiblePages.includes(row.tab as AppPage) ? row.tab : null;
          const body = (
            <>
              <span className="w-44 shrink-0 truncate text-left text-[0.82rem] text-[var(--ink)]">{row.label}</span>
              <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--line)]/60" aria-hidden="true">
                <span className={`block h-full rounded-full ${row.tone}`} style={{ width: `${(row.count / max) * 100}%` }} />
              </span>
              <span className="w-10 shrink-0 text-right text-[0.86rem] font-semibold [font-variant-numeric:tabular-nums] text-[var(--ink)]">{row.count.toLocaleString()}</span>
            </>
          );
          return (
            <li key={row.label}>
              {target ? (
                <button type="button" className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 transition hover:bg-[var(--accent-soft-bg)]" onClick={() => onSelectTab(target as DashboardTargetTab)}>
                  {body}
                </button>
              ) : (
                <div className="flex items-center gap-3 px-2 py-1.5">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </DashboardSubPanel>
  );
}

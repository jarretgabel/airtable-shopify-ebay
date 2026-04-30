import type { DashboardTargetTab } from './dashboardTabTypes';
import { DashboardSubPanel } from './dashboardPrimitives';

const severityClass = {
  critical: 'border-red-500/30 bg-red-950/25 text-red-300 hover:border-red-400/50',
  warning: 'border-amber-500/30 bg-amber-950/25 text-amber-300 hover:border-amber-400/50',
} as const;

const severityCountClass = {
  critical: 'bg-red-900/50 text-red-200',
  warning: 'bg-amber-900/50 text-amber-200',
} as const;

interface ActionItem {
  key: string;
  label: string;
  count: number;
  detail: string;
  severity: 'critical' | 'warning';
  targetTab: DashboardTargetTab;
  unavailable?: boolean;
}

function ActionButton({ item, onSelectTab }: { item: ActionItem; onSelectTab: (tab: DashboardTargetTab) => void }) {
  return (
    <button
      type="button"
      className={[
        'flex w-full items-start gap-3 rounded-[12px] border px-4 py-3.5 text-left transition',
        severityClass[item.severity],
        item.unavailable ? 'cursor-not-allowed opacity-80 hover:translate-y-0' : 'hover:-translate-y-px',
      ].join(' ')}
      disabled={item.unavailable}
      title={item.unavailable ? item.detail : undefined}
      onClick={() => {
        if (!item.unavailable) {
          onSelectTab(item.targetTab);
        }
      }}
    >
      <span className={`mt-0.5 shrink-0 rounded-full px-2.5 py-0.5 text-[0.75rem] font-bold tabular-nums ${severityCountClass[item.severity]}`}>
        {item.unavailable ? 'Off' : item.count}
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[0.88rem] font-semibold leading-snug">{item.label}</span>
        <span className="text-[0.78rem] opacity-75">{item.detail}</span>
      </div>
      <span className="ml-auto shrink-0 self-center text-[0.75rem] font-semibold opacity-60">{item.unavailable ? 'Unavailable' : 'Go →'}</span>
    </button>
  );
}

export interface DashboardActionsSectionProps {
  ebayAuthenticated: boolean;
  ebayDraftCount: number;
  ebayPublishedCount: number;
  ebayTotal: number;
  shopifyQueueApproved: number;
  shopifyQueuePending: number;
  shopifyQueueTotal: number;
  ebayUnavailableReason?: string | null;
  shopifyApprovalUnavailableReason?: string | null;
  onSelectTab: (tab: DashboardTargetTab) => void;
  embedded?: boolean;
}

export function DashboardActionsSection({
  ebayAuthenticated,
  ebayDraftCount,
  ebayPublishedCount,
  ebayTotal,
  shopifyQueueApproved,
  shopifyQueuePending,
  shopifyQueueTotal,
  ebayUnavailableReason,
  shopifyApprovalUnavailableReason,
  onSelectTab,
  embedded,
}: DashboardActionsSectionProps) {
  const items: ActionItem[] = [];

  if (shopifyApprovalUnavailableReason) {
    items.push({
      key: 'shopify-approval-unavailable',
      label: 'Shopify approval queue unavailable',
      count: 0,
      detail: shopifyApprovalUnavailableReason,
      severity: 'warning',
      targetTab: 'shopify-approval',
      unavailable: true,
    });
  }

  if (!shopifyApprovalUnavailableReason && shopifyQueuePending > 0) {
    items.push({
      key: 'shopify-approval',
      label: `${shopifyQueuePending} listing${shopifyQueuePending === 1 ? '' : 's'} awaiting approval`,
      count: shopifyQueuePending,
      detail: `${shopifyQueueApproved} approved · ${shopifyQueueTotal} total in queue`,
      severity: 'critical',
      targetTab: 'shopify-approval',
    });
  }

  if (ebayUnavailableReason) {
    items.push({
      key: 'ebay-unavailable',
      label: 'eBay publishing unavailable',
      count: 0,
      detail: ebayUnavailableReason,
      severity: 'warning',
      targetTab: 'ebay',
      unavailable: true,
    });
  }

  if (!ebayUnavailableReason && ebayAuthenticated && ebayDraftCount > 0) {
    items.push({
      key: 'ebay',
      label: `${ebayDraftCount} eBay draft${ebayDraftCount === 1 ? '' : 's'} ready to publish`,
      count: ebayDraftCount,
      detail: `${ebayPublishedCount} currently live · ${ebayTotal} total tracked SKUs`,
      severity: 'warning',
      targetTab: 'ebay',
    });
  }

  const content = items.length === 0 ? (
        <div className="flex items-center gap-3 rounded-[12px] border border-emerald-500/25 bg-emerald-950/20 px-4 py-4 text-[0.88rem] text-emerald-300">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <span>All clear — no actions required right now.</span>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <ActionButton key={item.key} item={item} onSelectTab={onSelectTab} />
          ))}
        </div>
      );

  if (embedded) {
    return <DashboardSubPanel title="Actions Needed">{content}</DashboardSubPanel>;
  }

  return (
    <section
      id="actions"
      className="scroll-mt-24 rounded-[14px] border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[0_1px_3px_rgba(17,32,49,0.06),0_4px_14px_rgba(17,32,49,0.05)]"
    >
      <div className="mb-4 flex items-center border-b border-[var(--line)] pb-3 pt-1">
        <h2 className="m-0 text-[1.05rem] font-semibold text-[var(--ink)]">Actions Needed</h2>
      </div>

      {content}
    </section>
  );
}

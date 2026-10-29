import { useEffect, useState } from 'react';
import { dashboardAppApi } from '@/services/app-api';
import type { FinanceSummary } from '@/services/app-api/dashboard';
import { DashboardSectionPanel, DashboardSourceWarning, DashboardSubPanel } from './dashboardPrimitives';

interface DashboardFinanceSectionProps {
  showWarnings?: boolean;
  loadFinance?: () => Promise<FinanceSummary>;
}

const loadDefaultFinance = () => dashboardAppApi.getFinance();
const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)]/60 px-4 py-3">
      <p className="text-[0.68rem] uppercase tracking-[0.08em] text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-xl font-semibold text-[var(--ink)]">{value}</p>
      {detail ? <p className="mt-0.5 text-[0.75rem] text-[var(--muted)]">{detail}</p> : null}
    </div>
  );
}

export function DashboardFinanceSection({ showWarnings = false, loadFinance = loadDefaultFinance }: DashboardFinanceSectionProps) {
  const [finance, setFinance] = useState<FinanceSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadFinance()
      .then((result) => { if (!cancelled) setFinance(result); })
      .catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : 'Could not load cost and earnings.'); });
    return () => { cancelled = true; };
  }, [loadFinance]);

  if (error) {
    return showWarnings ? (
      <DashboardSectionPanel id="finance" title="Cost & Earnings">
        <DashboardSourceWarning title="Cost and earnings unavailable" message={error} />
      </DashboardSectionPanel>
    ) : null;
  }
  if (!finance) return null;

  const { costOnHand, sold, earnings, soldWithoutSalePrice } = finance;

  return (
    <DashboardSectionPanel id="finance" title="Cost & Earnings">
      <DashboardSubPanel title="Cost">
        <div className="grid gap-3 sm:grid-cols-2">
          <Stat label="Cost of inventory on hand" value={currency.format(costOnHand.cost)} detail={`${costOnHand.items} items`} />
          <Stat label="Cost of items sold" value={currency.format(sold.cost)} detail={`${sold.items} items`} />
        </div>
      </DashboardSubPanel>
      <DashboardSubPanel title="Earnings (sales with a recorded sale price)">
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Revenue" value={currency.format(earnings.revenue)} detail={`${earnings.itemsWithSalePrice} items`} />
          <Stat label="Profit" value={currency.format(earnings.profit)} detail={earnings.marginPct === null ? undefined : `${earnings.marginPct}% margin`} />
          <Stat label="Sold, no sale price yet" value={String(soldWithoutSalePrice)} detail="Sold before sale prices were recorded" />
        </div>
      </DashboardSubPanel>
    </DashboardSectionPanel>
  );
}

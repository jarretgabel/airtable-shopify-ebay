import { useEffect, useState } from 'react';
import { dashboardAppApi } from '@/services/app-api';
import type { SellersSummary } from '@/services/app-api/dashboard';
import { DashboardSectionPanel, DashboardSourceWarning, DashboardSubPanel, StatTile } from './dashboardPrimitives';

interface DashboardSellersSectionProps {
  showWarnings?: boolean;
  loadSummary?: () => Promise<SellersSummary>;
}

const loadSellersSummary = () => dashboardAppApi.getSellersSummary();

export function DashboardSellersSection({ showWarnings = false, loadSummary = loadSellersSummary }: DashboardSellersSectionProps) {
  const [summary, setSummary] = useState<SellersSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadSummary()
      .then((result) => { if (!cancelled) setSummary(result); })
      .catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : 'Could not load sellers.'); });
    return () => { cancelled = true; };
  }, [loadSummary]);

  // The summary depends on the Postgres database, so quietly omit the card when it is unavailable.
  if (error) {
    return showWarnings ? (
      <DashboardSectionPanel id="sellers" title="Sellers">
        <DashboardSourceWarning title="Sellers summary unavailable" message={error} />
      </DashboardSectionPanel>
    ) : null;
  }
  if (!summary) return null;

  return (
    <DashboardSectionPanel id="sellers" title="Sellers">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Sellers" value={summary.totals.contacts} />
        <StatTile label="With items" value={summary.totals.sellersWithItems} />
        <StatTile label="Repeat sellers" value={summary.totals.repeatSellers} />
        <StatTile label="Mailing list" value={summary.totals.mailingListOptIns} />
      </div>
      <DashboardSubPanel title="Top sellers by items">
        <table className="w-full text-left text-[0.82rem] text-[var(--ink)]">
          <thead>
            <tr className="text-[0.68rem] uppercase tracking-[0.08em] text-[var(--muted)]">
              <th className="py-1 pr-3">Seller</th>
              <th className="py-1 pr-3">Location</th>
              <th className="py-1 pr-3">Items</th>
              <th className="py-1 pr-3">Last arrival</th>
              <th className="py-1">Mailing list</th>
            </tr>
          </thead>
          <tbody>
            {summary.topSellers.map((seller) => (
              <tr key={seller.email} className="border-t border-[var(--line)]">
                <td className="py-1.5 pr-3">{seller.email}</td>
                <td className="py-1.5 pr-3">{seller.location ?? '—'}</td>
                <td className="py-1.5 pr-3">{seller.itemCount}</td>
                <td className="py-1.5 pr-3">{seller.lastItemDate ?? '—'}</td>
                <td className="py-1.5">{seller.mailingListOptIn ? 'Yes' : 'No'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </DashboardSubPanel>
    </DashboardSectionPanel>
  );
}

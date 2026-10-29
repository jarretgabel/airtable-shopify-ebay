import { useEffect, useState } from 'react';
import { dashboardAppApi } from '@/services/app-api';
import type { DashboardDateRange, SellersSummary } from '@/services/app-api/dashboard';
import { tabFormControlBaseClass } from '@/components/tabs/uiClasses';
import { DashboardSectionPanel, DashboardSourceWarning, DashboardSubPanel, StatTile } from './dashboardPrimitives';

interface DashboardSellersSectionProps {
  showWarnings?: boolean;
  loadSummary?: (filters: DashboardDateRange & { search?: string }) => Promise<SellersSummary>;
}

const loadSellersSummary = (filters: DashboardDateRange & { search?: string }) => dashboardAppApi.getSellersSummary(10, filters);

export function DashboardSellersSection({ showWarnings = false, loadSummary = loadSellersSummary }: DashboardSellersSectionProps) {
  const [summary, setSummary] = useState<SellersSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  useEffect(() => {
    let cancelled = false;
    setError(null);
    const timer = setTimeout(() => {
      loadSummary({ search: search.trim(), from, to })
        .then((result) => { if (!cancelled) setSummary(result); })
        .catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : 'Could not load sellers.'); });
    }, search ? 300 : 0);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [loadSummary, search, from, to]);

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
      <div className="flex flex-wrap items-center gap-2 text-[0.8rem] text-[var(--muted)]">
        <input type="search" aria-label="Search sellers" placeholder="Search sellers by email, name or location" className={`${tabFormControlBaseClass} !w-auto min-w-[16rem] flex-1`} value={search} onChange={(event) => setSearch(event.target.value)} />
        <span>Last arrival</span>
        <input type="date" aria-label="Arrived from" className={`${tabFormControlBaseClass} !w-auto`} value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} />
        <span>to</span>
        <input type="date" aria-label="Arrived to" className={`${tabFormControlBaseClass} !w-auto`} value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} />
        {search || from || to ? <button type="button" className="underline" onClick={() => { setSearch(''); setFrom(''); setTo(''); }}>Clear</button> : null}
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

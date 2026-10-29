import { Fragment, useEffect, useState } from 'react';
import { dashboardAppApi } from '@/services/app-api';
import type { BuyerRow, BuyersSummary, DashboardDateRange } from '@/services/app-api/dashboard';
import { tabFormControlBaseClass } from '@/components/tabs/uiClasses';
import { DashboardSectionPanel, DashboardSourceWarning, StatTile } from './dashboardPrimitives';

interface DashboardBuyersSectionProps {
  showWarnings?: boolean;
  loadBuyers?: (filters: DashboardDateRange & { search?: string }) => Promise<BuyersSummary>;
}

const loadDefaultBuyers = (filters: DashboardDateRange & { search?: string }) => dashboardAppApi.getBuyers(filters);
const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

function summarizeItems(items: BuyerRow['items']): string {
  const labels = items.map((item) => item.title || item.sku || '').filter(Boolean);
  if (labels.length === 0) return '—';
  return labels.length > 1 ? `${labels[0]} +${labels.length - 1} more` : labels[0];
}

export function DashboardBuyersSection({ showWarnings = false, loadBuyers = loadDefaultBuyers }: DashboardBuyersSectionProps) {
  const [summary, setSummary] = useState<BuyersSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [openKey, setOpenKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    const timer = setTimeout(() => {
      loadBuyers({ search: search.trim(), from, to })
        .then((result) => { if (!cancelled) setSummary(result); })
        .catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : 'Could not load buyers.'); });
    }, search ? 300 : 0);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [loadBuyers, search, from, to]);

  if (error) {
    return showWarnings ? (
      <DashboardSectionPanel id="buyers" title="Buyers">
        <DashboardSourceWarning title="Buyers unavailable" message={error} />
      </DashboardSectionPanel>
    ) : null;
  }
  if (!summary) return null;

  return (
    <DashboardSectionPanel id="buyers" title="Buyers">
      <div className="grid grid-cols-3 gap-3">
        <StatTile label="Buyers" value={summary.totals.buyers} />
        <StatTile label="Items bought" value={summary.totals.items} />
        <StatTile label="Revenue" value={currency.format(summary.totals.revenue)} />
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[0.8rem] text-[var(--muted)]">
        <input type="search" aria-label="Search buyers" placeholder="Search by name, email, phone, SKU or order" className={`${tabFormControlBaseClass} !w-auto min-w-[16rem] flex-1`} value={search} onChange={(event) => setSearch(event.target.value)} />
        <span>Sold</span>
        <input type="date" aria-label="Bought from" className={`${tabFormControlBaseClass} !w-auto`} value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} />
        <span>to</span>
        <input type="date" aria-label="Bought to" className={`${tabFormControlBaseClass} !w-auto`} value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} />
        {search || from || to ? <button type="button" className="underline" onClick={() => { setSearch(''); setFrom(''); setTo(''); }}>Clear</button> : null}
      </div>
      {summary.buyers.length === 0 ? (
        <p className="text-[0.82rem] text-[var(--muted)]">No buyers recorded yet. Buyer details are saved from new Shopify and eBay sales.</p>
      ) : (
        <table className="w-full text-left text-[0.82rem] text-[var(--ink)]">
          <thead>
            <tr className="text-[0.68rem] uppercase tracking-[0.08em] text-[var(--muted)]">
              <th className="py-1 pr-3">Buyer</th>
              <th className="py-1 pr-3">Email</th>
              <th className="py-1 pr-3">Bought</th>
              <th className="py-1 pr-3">Spent</th>
              <th className="py-1">Last purchase</th>
            </tr>
          </thead>
          <tbody>
            {summary.buyers.map((buyer) => (
              <Fragment key={buyer.key}>
                <tr className="cursor-pointer border-t border-[var(--line)]" onClick={() => setOpenKey(openKey === buyer.key ? null : buyer.key)}>
                  <td className="py-1.5 pr-3">{buyer.name ?? '—'}</td>
                  <td className="py-1.5 pr-3">{buyer.email ?? '—'}</td>
                  <td className="py-1.5 pr-3">{summarizeItems(buyer.items)}</td>
                  <td className="py-1.5 pr-3">{currency.format(buyer.totalSpent)}</td>
                  <td className="py-1.5">{buyer.lastPurchase ?? '—'}</td>
                </tr>
                {openKey === buyer.key ? (
                  <tr>
                    <td colSpan={5} className="pb-2 pl-2 text-[0.78rem] text-[var(--muted)]">
                      <p>{[buyer.phone, buyer.shipTo].filter(Boolean).join(' · ') || 'No contact details'}</p>
                      <ul className="mt-1 list-disc pl-5">
                        {buyer.items.map((item) => (
                          <li key={item.recordId}>
                            {[item.sku, item.title].filter(Boolean).join(' ') || item.recordId}
                            {item.price !== null ? ` — ${currency.format(item.price)}` : ''}
                            {item.soldVia ? ` via ${item.soldVia}` : ''}
                            {item.soldAt ? ` on ${item.soldAt}` : ''}
                            {item.order ? ` (order ${item.order})` : ''}
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
          </tbody>
        </table>
      )}
    </DashboardSectionPanel>
  );
}

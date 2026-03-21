import { spinnerClass } from '@/components/tabs/uiClasses';

const sectionBaseClass = 'scroll-mt-24';
const sectionHeaderClass = 'mb-4 flex items-center border-b border-[var(--line)] pb-3 pt-1';
const sectionHeaderLabelClass = 'm-0 text-[1.05rem] font-semibold text-[var(--ink)]';

interface DashboardShopifySectionProps {
  jfLoading: boolean;
  spLoading: boolean;
  submissionWindowTotal: number;
  submissionAverage: number;
  activeSubmissionDays: number;
  peakSubmissionDay: { label: string; count: number } | null;
  peakSubmissionShare: number;
  chartGuideValues: number[];
  maxDayCount: number;
  submissionDays: Array<{ label: string; count: number }>;
  productsCount: number;
  activeProductsCount: number;
  draftProductsCount: number;
  archivedProductsCount: number;
  avgAskPrice: number;
  inventoryValue: number;
  grossMarginPct: number | null;
  acquisitionCost: number;
  totalAsk: number;
}

export function DashboardShopifySection(props: DashboardShopifySectionProps) {
  const {
    jfLoading,
    spLoading,
    submissionWindowTotal,
    submissionAverage,
    activeSubmissionDays,
    peakSubmissionDay,
    peakSubmissionShare,
    chartGuideValues,
    maxDayCount,
    submissionDays,
    productsCount,
    activeProductsCount,
    draftProductsCount,
    archivedProductsCount,
    avgAskPrice,
    inventoryValue,
    grossMarginPct,
    acquisitionCost,
    totalAsk,
  } = props;

  return (
    <div id="pipeline" className={`${sectionBaseClass} grid grid-cols-1 gap-4 md:grid-cols-2`}>
      <div className={`md:col-span-2 ${sectionHeaderClass}`}><h2 className={sectionHeaderLabelClass}>Shopify</h2></div>

      <section className="flex flex-col gap-4 rounded-[14px] border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[0_1px_3px_rgba(17,32,49,0.06),0_4px_14px_rgba(17,32,49,0.05)]">
        <h2 className="m-0 flex items-baseline gap-2 border-b border-[var(--line)] pb-3 text-[0.92rem] font-bold text-[var(--ink)]">Submission Volume <span className="text-[0.72rem] font-medium tracking-[0.02em] text-[var(--muted)]">Last 14 days</span></h2>
        {jfLoading ? (
          <div className="flex items-center gap-3 py-6 text-[var(--muted)]"><div className={spinnerClass} /><p>Loading…</p></div>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-3 gap-[0.8rem]">
              <div className="flex flex-col gap-[0.28rem] rounded-[14px] border border-[var(--line)] bg-[var(--bg)] p-[0.85rem_0.95rem]"><span className="text-[0.68rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">14-day total</span><strong className="text-[0.96rem] leading-[1.35] text-[var(--ink)]">{submissionWindowTotal}</strong></div>
              <div className="flex flex-col gap-[0.28rem] rounded-[14px] border border-[var(--line)] bg-[var(--bg)] p-[0.85rem_0.95rem]"><span className="text-[0.68rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Average / day</span><strong className="text-[0.96rem] leading-[1.35] text-[var(--ink)]">{submissionAverage.toFixed(1)}</strong></div>
              <div className="flex flex-col gap-[0.28rem] rounded-[14px] border border-[var(--line)] bg-[var(--bg)] p-[0.85rem_0.95rem]"><span className="text-[0.68rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Peak day</span><strong className="text-[0.96rem] leading-[1.35] text-[var(--ink)]">{peakSubmissionDay ? `${peakSubmissionDay.count} on ${peakSubmissionDay.label}` : 'No activity'}</strong></div>
            </div>

            <div className="rounded-[18px] border border-[var(--line)] bg-[radial-gradient(circle_at_top,rgba(104,164,255,0.08),transparent_55%),linear-gradient(180deg,rgba(16,26,40,0.98),rgba(11,20,31,0.98))] p-4">
              <div className="mb-[0.85rem] flex flex-wrap justify-between gap-4">
                <p className="m-0 text-[0.82rem] text-[var(--muted)] [&_strong]:text-[var(--ink)]"><strong>{activeSubmissionDays}</strong> active days in the last two weeks</p>
                <p className="m-0 text-[0.82rem] text-[var(--muted)] [&_strong]:text-[var(--ink)]">Peak day represented <strong>{peakSubmissionShare}%</strong> of inbound volume</p>
              </div>
              <div className="relative pb-0 pl-[2.9rem] pt-[1.2rem]">
                <div className="pointer-events-none absolute left-0 right-0 top-0 flex justify-start"><span className="pl-[0.1rem] text-[0.68rem] font-bold uppercase leading-none tracking-[0.08em] text-[var(--muted)]">Submissions per day</span></div>
                <div className="relative h-[180px]">
                  <div className="absolute inset-0 pointer-events-none" aria-hidden="true">{chartGuideValues.map((value, index) => <div key={`${value}-${index}`} className={`absolute left-0 right-0 border-t border-dashed border-[rgba(148,163,184,0.35)] [min-height:1px] ${index === 0 ? 'top-0' : 'top-1/2 -translate-y-[0.5px]'}`}><span className="absolute left-[-2rem] top-[-0.55rem] text-[0.7rem] text-[var(--muted)] [font-variant-numeric:tabular-nums]">{value}</span></div>)}</div>
                  <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-px bg-[rgba(148,163,184,0.45)]" aria-hidden="true"><span className="absolute left-[-2rem] top-[-0.7rem] text-[0.7rem] text-[var(--muted)] [font-variant-numeric:tabular-nums]">0</span></div>
                  <div className="relative flex h-full items-stretch gap-[10px]">{submissionDays.map((day, index) => {
                    const height = maxDayCount > 0 ? day.count > 0 ? Math.max(8, Math.round((day.count / maxDayCount) * 100)) : 0 : 0;
                    const isPeak = peakSubmissionDay?.label === day.label && peakSubmissionDay?.count === day.count && day.count > 0;
                    const hasVolume = day.count > 0;
                    return <div key={index} className="relative z-[1] flex h-full flex-1 items-end"><div className="flex h-full w-full items-end justify-center"><div className="flex h-full w-[72%] items-end justify-center rounded-t-[14px] bg-[linear-gradient(180deg,rgba(148,163,184,0.08),rgba(148,163,184,0.02))]"><div className={[
                      'relative w-full rounded-t-[10px] transition-[opacity,transform,filter] duration-[120ms]',
                      !hasVolume && 'min-h-0 opacity-0 shadow-none',
                      hasVolume && !isPeak && 'min-h-[6px] bg-[linear-gradient(180deg,var(--accent),#5da6ff)] opacity-90 shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_-2px_12px_rgba(31,111,235,0.12)] hover:opacity-100 hover:-translate-y-0.5 hover:brightness-[1.03]',
                      hasVolume && isPeak && 'min-h-[6px] bg-[linear-gradient(180deg,#22d3ee,#3b82f6_55%,#2563eb)] opacity-90 shadow-[0_14px_26px_rgba(59,130,246,0.24)] hover:opacity-100 hover:-translate-y-0.5 hover:brightness-[1.03]',
                    ].filter(Boolean).join(' ')} style={{ height: `${height}%` }} title={`${day.label}: ${day.count} submissions`} aria-label={`${day.label}: ${day.count} submissions`}>{isPeak && <span className="absolute left-1/2 top-[-6px] h-[10px] w-[10px] -translate-x-1/2 rounded-full bg-[#67e8f9] shadow-[0_0_0_4px_rgba(103,232,249,0.14)]" aria-hidden="true" />}</div></div></div></div>;
                  })}</div>
                </div>
                <div className="mt-[0.45rem] flex min-h-[1rem] gap-[10px]">{submissionDays.map((day, index) => <span key={`${day.label}-${index}`} className="flex-1 whitespace-nowrap text-center text-[0.64rem] font-semibold text-[var(--muted)] [font-variant-numeric:tabular-nums]">{day.label.split(' ')[1] ?? day.label}</span>)}</div>
                <div className="pointer-events-none relative mt-[0.2rem] flex justify-end"><span className="pr-[0.1rem] text-[0.68rem] font-bold uppercase leading-none tracking-[0.08em] text-[var(--muted)]">Date</span></div>
              </div>
            </div>
          </>
        )}
      </section>

      <section className="flex flex-col gap-4 rounded-[14px] border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[0_1px_3px_rgba(17,32,49,0.06),0_4px_14px_rgba(17,32,49,0.05)]">
        <h2 className="m-0 flex items-baseline gap-2 border-b border-[var(--line)] pb-3 text-[0.92rem] font-bold text-[var(--ink)]">Sales Performance</h2>
        <div className="grid grid-cols-2 gap-x-6 max-[520px]:grid-cols-1">
          <MetricRow label="Total Listings" value={spLoading ? '…' : productsCount} />
          <MetricRow label="Active" value={spLoading ? '…' : activeProductsCount} valueClass="text-green-400" />
          <MetricRow label="Draft / Pending" value={spLoading ? '…' : draftProductsCount} valueClass="text-amber-400" />
          <MetricRow label="Sold / Archived" value={spLoading ? '…' : archivedProductsCount} valueClass="font-medium text-[var(--muted)]" />
          <MetricRow label="Avg Ask Price" value={spLoading ? '…' : avgAskPrice > 0 ? `$${Math.round(avgAskPrice).toLocaleString()}` : '—'} />
          <MetricRow label="Total Ask Value" value={spLoading ? '…' : inventoryValue > 0 ? `$${inventoryValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'} valueClass="text-green-400" />
          <MetricRow label="Gross Margin" value={grossMarginPct !== null ? `${grossMarginPct}%` : '—'} valueClass={grossMarginPct !== null && grossMarginPct > 0 ? 'text-green-400' : 'text-[var(--ink)]'} />
          <MetricRow label="Potential Profit" value={acquisitionCost > 0 && totalAsk > 0 ? `$${(totalAsk - acquisitionCost).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'} valueClass="text-green-400" />
        </div>
      </section>
    </div>
  );
}

function MetricRow({ label, value, valueClass }: { label: string; value: string | number; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between border-b border-[var(--line)] py-[0.6rem] [&:nth-last-child(-n+2)]:border-b-0">
      <span className="text-[0.8rem] text-[var(--muted)]">{label}</span>
      <span className={`text-[0.9rem] font-bold [font-variant-numeric:tabular-nums] ${valueClass ?? 'text-[var(--ink)]'}`}>{value}</span>
    </div>
  );
}

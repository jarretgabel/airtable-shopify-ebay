import { formatAnswer } from '@/services/jotform';
import { spinnerClass } from '@/components/tabs/uiClasses';
import type { DashboardTargetTab } from './dashboardTabTypes';
import type { JotFormSubmission } from '@/types/jotform';
import { DashboardSectionPanel, DashboardSubPanel } from './dashboardPrimitives';

interface DashboardJotformSectionProps {
  jfLoading: boolean;
  submissionWindowTotal: number;
  submissionAverage: number;
  activeSubmissionDays: number;
  peakSubmissionDay: { label: string; count: number } | null;
  peakSubmissionShare: number;
  chartGuideValues: number[];
  maxDayCount: number;
  submissionDays: Array<{ label: string; count: number }>;
  topBrands: Array<[string, number]>;
  jfSubmissions: JotFormSubmission[];
  now: number;
  onSelectTab: (tab: DashboardTargetTab) => void;
}

function toPercent(count: number, max: number): number {
  if (max <= 0) return 0;
  return Math.round((count / max) * 100);
}

export function DashboardJotformSection({
  jfLoading,
  submissionWindowTotal,
  submissionAverage,
  activeSubmissionDays,
  peakSubmissionDay,
  peakSubmissionShare,
  chartGuideValues,
  maxDayCount,
  submissionDays,
  topBrands,
  jfSubmissions,
  now,
  onSelectTab,
}: DashboardJotformSectionProps) {
  return (
    <DashboardSectionPanel id="inquiries" title="JotForm">
      <DashboardSubPanel title={<>Submission Volume <span className="text-[0.72rem] font-medium tracking-[0.02em] text-[var(--muted)]">Last 14 days</span></>}>
        {jfLoading ? (
          <div className="flex items-center gap-3 py-6 text-[var(--muted)]"><div className={spinnerClass} /><p>Loading…</p></div>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-1 gap-[0.8rem] sm:grid-cols-3">
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
      </DashboardSubPanel>

      <DashboardSubPanel title={<>Top Requested Brands <span className="text-[0.72rem] font-medium tracking-[0.02em] text-[var(--muted)]">From last 500 submissions</span></>}>
        {jfLoading ? <div className="flex items-center gap-3 py-4 text-[var(--muted)]"><div className={spinnerClass} /><p>Loading…</p></div> : topBrands.length > 0 ? <ul className="m-0 flex list-none flex-col gap-[0.65rem] p-0">{topBrands.map(([brand, count], index) => <li key={`${brand}-${index}`} className="grid grid-cols-[130px_1fr_36px] items-center gap-3 max-[520px]:grid-cols-[90px_1fr_30px]"><span className="overflow-hidden text-ellipsis whitespace-nowrap text-[0.82rem] font-semibold text-[var(--ink)]">{brand}</span><div className="h-[7px] overflow-hidden rounded-full bg-[var(--line)]"><div className="h-full min-w-[4px] rounded-full bg-[linear-gradient(90deg,var(--accent),#5da6ff)] transition-[width] duration-[600ms] ease-in-out" style={{ width: `${toPercent(count, topBrands[0]?.[1] ?? 0)}%` }} /></div><span className="text-right text-[0.75rem] font-semibold text-[var(--muted)] [font-variant-numeric:tabular-nums]">{count}</span></li>)}</ul> : <p style={{ color: 'var(--muted)', margin: 0 }}>No brand data yet.</p>}
      </DashboardSubPanel>

      <DashboardSubPanel title={<>Recent Submissions <span className="text-[0.72rem] font-medium tracking-[0.02em] text-[var(--muted)]">Latest 8</span></>}>
        {jfLoading ? <div className="flex items-center gap-3 py-4 text-[var(--muted)]"><div className={spinnerClass} /><p>Loading…</p></div> : <><ul className="m-0 flex-1 list-none p-0">{jfSubmissions.slice(0, 8).map((submission, index) => {
          const rawAnswers = submission.answers && typeof submission.answers === 'object' ? submission.answers : {};
          const sortedAnswers = Object.values(rawAnswers)
            .filter((answer) => formatAnswer(answer?.answer))
            .sort((a, b) => Number(a.order) - Number(b.order));
          const name = formatAnswer(sortedAnswers.find((answer) => /name/i.test(answer.text || ''))?.answer) || formatAnswer(sortedAnswers[0]?.answer) || 'Unknown';
          const brand = formatAnswer(sortedAnswers.find((answer) => /brand/i.test(answer.text || ''))?.answer);
          const model = formatAnswer(sortedAnswers.find((answer) => /model/i.test(answer.text || ''))?.answer);
          const submittedAt = new Date(submission.created_at);
          const submittedAtTs = submittedAt.getTime();
          const safeSubmittedTs = Number.isFinite(submittedAtTs) ? submittedAtTs : now;
          const isNew = submission.new === '1';
          const minutesAgo = Math.max(0, Math.round((now - safeSubmittedTs) / 60000));
          const timeLabel = minutesAgo < 60 ? `${minutesAgo}m ago` : minutesAgo < 1440 ? `${Math.round(minutesAgo / 60)}h ago` : submittedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          return <li key={submission.id || `submission-${index}`} className={`flex items-center justify-between gap-2 border-b border-[var(--line)] py-[0.6rem] last:border-b-0${isNew ? ' -mx-2 rounded-[6px] bg-[linear-gradient(90deg,rgba(31,111,235,0.05),transparent)] px-2' : ''}`}><div className="flex min-w-0 items-center gap-2">{isNew && <span className="h-2 w-2 flex-shrink-0 rounded-full bg-[var(--accent)]" />}<div><p className="m-0 max-w-[190px] overflow-hidden text-ellipsis whitespace-nowrap text-[0.84rem] font-semibold text-[var(--ink)]">{name}</p>{(brand || model) && <p className="m-0 mt-[0.1rem] max-w-[190px] overflow-hidden text-ellipsis whitespace-nowrap text-[0.74rem] text-[var(--muted)]">{[brand, model].filter(Boolean).join(' · ')}</p>}</div></div><div className="flex shrink-0 items-center gap-[0.65rem]"><span className="text-[0.72rem] text-[var(--muted)] [font-variant-numeric:tabular-nums]">{timeLabel}</span><button type="button" className="cursor-pointer border-0 bg-transparent p-0 text-[0.76rem] font-bold text-[var(--accent)] no-underline hover:underline" onClick={() => onSelectTab('jotform')}>View</button></div></li>;
        })}{jfSubmissions.length === 0 && <li style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>No submissions loaded.</li>}</ul><button className="cursor-pointer self-start rounded-lg border border-[var(--line)] bg-transparent px-[0.85rem] py-[0.38rem] text-[0.78rem] font-semibold text-[var(--accent)] transition-[background,border-color] duration-[140ms] hover:border-[var(--accent)] hover:bg-[var(--panel)]" onClick={() => onSelectTab('jotform')}>View all {jfSubmissions.length.toLocaleString()} submissions →</button></>}
      </DashboardSubPanel>
    </DashboardSectionPanel>
  );
}

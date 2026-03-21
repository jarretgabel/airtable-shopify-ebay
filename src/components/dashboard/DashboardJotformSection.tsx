import { formatAnswer } from '@/services/jotform';
import { spinnerClass } from '@/components/tabs/uiClasses';
import type { DashboardTargetTab } from './dashboardTabTypes';
import type { JotFormSubmission } from '@/types/jotform';

const sectionBaseClass = 'scroll-mt-24';
const sectionHeaderClass = 'mb-4 flex items-center border-b border-[var(--line)] pb-3 pt-1';
const sectionHeaderLabelClass = 'm-0 text-[1.05rem] font-semibold text-[var(--ink)]';

interface DashboardJotformSectionProps {
  jfLoading: boolean;
  topBrands: Array<[string, number]>;
  jfSubmissions: JotFormSubmission[];
  now: number;
  onSelectTab: (tab: DashboardTargetTab) => void;
}

export function DashboardJotformSection({ jfLoading, topBrands, jfSubmissions, now, onSelectTab }: DashboardJotformSectionProps) {
  return (
    <div id="inquiries" className={`${sectionBaseClass} grid grid-cols-1 gap-4 md:grid-cols-2`}>
      <div className={`md:col-span-2 ${sectionHeaderClass}`}><h2 className={sectionHeaderLabelClass}>JotForm</h2></div>

      <section className="flex flex-col gap-4 rounded-[14px] border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[0_1px_3px_rgba(17,32,49,0.06),0_4px_14px_rgba(17,32,49,0.05)]">
        <h2 className="m-0 flex items-baseline gap-2 border-b border-[var(--line)] pb-3 text-[0.92rem] font-bold text-[var(--ink)]">Top Requested Brands <span className="text-[0.72rem] font-medium tracking-[0.02em] text-[var(--muted)]">From last 500 submissions</span></h2>
        {jfLoading ? <div className="flex items-center gap-3 py-4 text-[var(--muted)]"><div className={spinnerClass} /><p>Loading…</p></div> : topBrands.length > 0 ? <ul className="m-0 flex list-none flex-col gap-[0.65rem] p-0">{topBrands.map(([brand, count]) => <li key={brand} className="grid grid-cols-[130px_1fr_36px] items-center gap-3 max-[520px]:grid-cols-[90px_1fr_30px]"><span className="overflow-hidden text-ellipsis whitespace-nowrap text-[0.82rem] font-semibold text-[var(--ink)]">{brand}</span><div className="h-[7px] overflow-hidden rounded-full bg-[var(--line)]"><div className="h-full min-w-[4px] rounded-full bg-[linear-gradient(90deg,var(--accent),#5da6ff)] transition-[width] duration-[600ms] ease-in-out" style={{ width: `${Math.round((count / topBrands[0][1]) * 100)}%` }} /></div><span className="text-right text-[0.75rem] font-semibold text-[var(--muted)] [font-variant-numeric:tabular-nums]">{count}</span></li>)}</ul> : <p style={{ color: 'var(--muted)', margin: 0 }}>No brand data yet.</p>}
      </section>

      <section className="flex flex-col gap-4 rounded-[14px] border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[0_1px_3px_rgba(17,32,49,0.06),0_4px_14px_rgba(17,32,49,0.05)]">
        <h2 className="m-0 flex items-baseline gap-2 border-b border-[var(--line)] pb-3 text-[0.92rem] font-bold text-[var(--ink)]">Recent Submissions <span className="text-[0.72rem] font-medium tracking-[0.02em] text-[var(--muted)]">Latest 8</span></h2>
        {jfLoading ? <div className="flex items-center gap-3 py-4 text-[var(--muted)]"><div className={spinnerClass} /><p>Loading…</p></div> : <><ul className="m-0 flex-1 list-none p-0">{jfSubmissions.slice(0, 8).map((submission) => {
          const sortedAnswers = Object.values(submission.answers).filter((answer) => formatAnswer(answer.answer)).sort((a, b) => Number(a.order) - Number(b.order));
          const name = formatAnswer(sortedAnswers.find((answer) => /name/i.test(answer.text || ''))?.answer) || formatAnswer(sortedAnswers[0]?.answer) || 'Unknown';
          const brand = formatAnswer(sortedAnswers.find((answer) => /brand/i.test(answer.text || ''))?.answer);
          const model = formatAnswer(sortedAnswers.find((answer) => /model/i.test(answer.text || ''))?.answer);
          const submittedAt = new Date(submission.created_at);
          const isNew = submission.new === '1';
          const minutesAgo = Math.round((now - submittedAt.getTime()) / 60000);
          const timeLabel = minutesAgo < 60 ? `${minutesAgo}m ago` : minutesAgo < 1440 ? `${Math.round(minutesAgo / 60)}h ago` : submittedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          return <li key={submission.id} className={`flex items-center justify-between gap-2 border-b border-[var(--line)] py-[0.6rem] last:border-b-0${isNew ? ' -mx-2 rounded-[6px] bg-[linear-gradient(90deg,rgba(31,111,235,0.05),transparent)] px-2' : ''}`}><div className="flex min-w-0 items-center gap-2">{isNew && <span className="h-2 w-2 flex-shrink-0 rounded-full bg-[var(--accent)]" />}<div><p className="m-0 max-w-[190px] overflow-hidden text-ellipsis whitespace-nowrap text-[0.84rem] font-semibold text-[var(--ink)]">{name}</p>{(brand || model) && <p className="m-0 mt-[0.1rem] max-w-[190px] overflow-hidden text-ellipsis whitespace-nowrap text-[0.74rem] text-[var(--muted)]">{[brand, model].filter(Boolean).join(' · ')}</p>}</div></div><div className="flex shrink-0 items-center gap-[0.65rem]"><span className="text-[0.72rem] text-[var(--muted)] [font-variant-numeric:tabular-nums]">{timeLabel}</span><button type="button" className="cursor-pointer border-0 bg-transparent p-0 text-[0.76rem] font-bold text-[var(--accent)] no-underline hover:underline" onClick={() => onSelectTab('jotform')}>View</button></div></li>;
        })}{jfSubmissions.length === 0 && <li style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>No submissions loaded.</li>}</ul><button className="cursor-pointer self-start rounded-lg border border-[var(--line)] bg-transparent px-[0.85rem] py-[0.38rem] text-[0.78rem] font-semibold text-[var(--accent)] transition-[background,border-color] duration-[140ms] hover:border-[var(--accent)] hover:bg-[var(--panel)]" onClick={() => onSelectTab('jotform')}>View all {jfSubmissions.length.toLocaleString()} submissions →</button></>}
      </section>
    </div>
  );
}

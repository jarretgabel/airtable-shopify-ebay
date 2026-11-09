import { useState } from 'react';
import { DashboardSectionPanel } from '@/components/dashboard/dashboardPrimitives';
import type { SeoCitationSummary, SeoPageSpeedRow } from '@/services/app-api/seo';

const dateTime = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' });
const tone = (score: number | null) => (score === null ? 'text-[var(--muted)]' : score >= 90 ? 'text-emerald-500' : score >= 50 ? 'text-amber-500' : 'text-red-500');
const buttonClass = 'rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-2 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] disabled:opacity-60';

const seconds = (ms: number | null) => (ms === null ? '–' : `${(ms / 1000).toFixed(1)} s`);

function shortUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}` || '/';
  } catch {
    return url;
  }
}

function ScoreCell({ value }: { value: number | null }) {
  return <td className={`py-1.5 pr-3 font-semibold ${tone(value)}`}>{value ?? '–'}</td>;
}

export function PageSpeedPanel({ rows }: { rows: SeoPageSpeedRow[] }) {
  const scored = rows.filter((row) => row.performance !== null);
  const failed = rows.filter((row) => row.performance === null);
  return (
    <DashboardSectionPanel id="seo-pagespeed" title="Page speed (mobile)">
      <p className="m-0 text-[0.75rem] text-[var(--muted)]">
        Google PageSpeed (Lighthouse) results for the home page and a rotating sample of each page type, refreshed with every audit. Scores are 0-100; LCP is how long the main content takes to appear, CLS is layout shift, TBT is time the page is blocked.
      </p>
      {scored.length === 0 ? (
        <p className="m-0 text-sm text-[var(--muted)]">
          {failed.length > 0 ? `PageSpeed could not be read yet: ${failed[0].error ?? 'unknown error'}.` : 'No PageSpeed results yet. They are collected at the end of each audit.'}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[0.82rem] text-[var(--ink)]">
            <thead><tr className="text-[0.68rem] uppercase tracking-[0.08em] text-[var(--muted)]"><th className="py-1 pr-3">Page</th><th className="py-1 pr-3">Speed</th><th className="py-1 pr-3">Accessibility</th><th className="py-1 pr-3">Best practices</th><th className="py-1 pr-3">SEO</th><th className="py-1 pr-3">LCP</th><th className="py-1 pr-3">CLS</th><th className="py-1 pr-3">TBT</th><th className="py-1 pr-3">Checked</th></tr></thead>
            <tbody>
              {scored.map((row) => (
                <tr key={row.url} className="border-t border-[var(--line)]">
                  <td className="max-w-[20rem] truncate py-1.5 pr-3" title={row.url}><a className="underline" href={row.url} target="_blank" rel="noreferrer">{shortUrl(row.url)}</a></td>
                  <ScoreCell value={row.performance} />
                  <ScoreCell value={row.accessibility} />
                  <ScoreCell value={row.bestPractices} />
                  <ScoreCell value={row.seo} />
                  <td className="py-1.5 pr-3">{seconds(row.lcpMs)}</td>
                  <td className="py-1.5 pr-3">{row.cls === null ? '–' : row.cls.toFixed(2)}</td>
                  <td className="py-1.5 pr-3">{row.tbtMs === null ? '–' : `${row.tbtMs} ms`}</td>
                  <td className="py-1.5 pr-3 text-[var(--muted)]">{dateTime.format(new Date(row.checkedAt))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {scored.length > 0 && failed.length > 0 ? <p className="m-0 text-[0.75rem] text-[var(--muted)]">{failed.length} sampled page(s) could not be checked this time.</p> : null}
    </DashboardSectionPanel>
  );
}

export function CitationPanel({ domain, citations, busy, onRun }: { domain: string; citations: SeoCitationSummary; busy: boolean; onRun: () => void }) {
  const [openQuestion, setOpenQuestion] = useState<string | null>(null);
  const run = citations.latestRun;
  const running = busy || citations.running;
  return (
    <DashboardSectionPanel id="seo-citations" title="AI answer check">
      <p className="m-0 text-[0.75rem] text-[var(--muted)]">
        Asks Claude (with web search) buyer-style questions and checks whether {domain} is named or cited in the answer. A spot check, not a ranking: answers vary run to run. Each run uses web searches, so it only runs when you ask.
      </p>
      <div className="flex flex-wrap items-center gap-3 text-[0.8rem] text-[var(--muted)]">
        <button type="button" className={buttonClass} disabled={running} onClick={onRun}>{running ? 'Checking…' : 'Run AI answer check'}</button>
        {run ? <span>Last check {run.finishedAt ? dateTime.format(new Date(run.finishedAt)) : ''}</span> : <span>No check has run yet.</span>}
      </div>
      {run?.status === 'failed' ? <p role="alert" className="m-0 text-sm text-red-500">The last check failed: {run.error ?? citations.checks[0]?.error ?? 'unknown error'}</p> : null}
      {run && run.status === 'completed' ? (
        <>
          <p className="m-0 text-sm">
            Named in <span className="font-semibold">{run.mentionedCount}</span> of {run.questionCount} answers · cited as a source in <span className="font-semibold">{run.citedCount}</span>
            {citations.history.length > 1 ? <span className="text-[var(--muted)]"> · previous checks: {citations.history.slice(0, -1).map((point) => `${point.mentionedCount}/${point.questionCount}`).join(', ')}</span> : null}
          </p>
          <ul className="m-0 list-none space-y-2 p-0 text-[0.85rem]">
            {citations.checks.map((check) => (
              <li key={check.question} className="border-t border-[var(--line)] pt-2">
                <button type="button" className="w-full text-left" onClick={() => setOpenQuestion(openQuestion === check.question ? null : check.question)}>
                  <span className={check.error ? 'text-red-500' : check.mentioned ? 'text-emerald-500' : 'text-[var(--muted)]'}>{check.error ? '!' : check.mentioned ? '✓' : '✕'}</span> {check.question}
                  {check.cited ? <span className="text-emerald-500"> · cited</span> : null}
                </button>
                {openQuestion === check.question ? (
                  <div className="mt-1 space-y-1 text-[var(--muted)]">
                    {check.error ? <p className="m-0">{check.error}</p> : <p className="m-0 whitespace-pre-wrap">{check.answer}</p>}
                    {check.sources.length > 0 ? <p className="m-0">Sources: {check.sources.join(', ')}</p> : null}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </DashboardSectionPanel>
  );
}

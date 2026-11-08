import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { AppPageLayout } from '@/components/app/AppPageLayout';
import { WorkflowPageHeader } from '@/components/app/WorkflowPageHeader';
import { DashboardSectionPanel, DashboardSubPanel, StatTile } from '@/components/dashboard/dashboardPrimitives';
import { tabFormControlBaseClass } from '@/components/tabs/uiClasses';
import { seoAppApi } from '@/services/app-api';
import type { SeoPageRow, SeoSummary } from '@/services/app-api/seo';

type SortKey = 'seoScore' | 'aioScore' | 'url';

const POLL_MS = 15_000;
const dateTime = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' });

export const scoreTone = (score: number | null) => (score === null ? 'text-[var(--muted)]' : score >= 80 ? 'text-emerald-500' : score >= 60 ? 'text-amber-500' : 'text-red-500');

function Score({ value }: { value: number | null }) {
  return <span className={`font-semibold ${scoreTone(value)}`}>{value === null ? '–' : value}</span>;
}

function shortUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}` || '/';
  } catch {
    return url;
  }
}

function PageRow({ page, open, onToggle }: { page: SeoPageRow; open: boolean; onToggle: () => void }) {
  return (
    <Fragment>
      <tr className="cursor-pointer border-t border-[var(--line)] hover:bg-white/5" onClick={onToggle}>
        <td className="max-w-[28rem] truncate py-1.5 pr-3" title={page.url}>{shortUrl(page.url)}</td>
        <td className="py-1.5 pr-3 capitalize">{page.pageType}</td>
        <td className="py-1.5 pr-3"><Score value={page.seoScore} /></td>
        <td className="py-1.5 pr-3"><Score value={page.aioScore} /></td>
        <td className="py-1.5 pr-3">{page.issues.length}</td>
        <td className="py-1.5 pr-3">{open ? 'Hide' : 'Details'}</td>
      </tr>
      {open ? (
        <tr className="border-t border-[var(--line)] bg-[var(--bg)]/60">
          <td colSpan={6} className="px-3 py-3 text-[0.8rem]">
            <p className="m-0"><a className="underline" href={page.url} target="_blank" rel="noreferrer">{page.url}</a></p>
            <p className="m-0 mt-1 text-[var(--muted)]">
              Title: {page.title ?? 'none'} · H1: {page.h1 ?? 'none'} · {page.wordCount ?? 0} words · HTTP {page.statusCode ?? 'error'}
              {page.responseMs !== null ? ` · ${page.responseMs} ms` : ''} · Schema: {page.schemaTypes.join(', ') || 'none'}
            </p>
            {page.issues.length === 0 ? <p className="m-0 mt-2">No issues found.</p> : (
              <ul className="m-0 mt-2 list-disc pl-5">
                {page.issues.map((issue) => (
                  <li key={`${issue.kind}-${issue.id}`}>
                    <span className="font-semibold uppercase">{issue.kind}</span> −{issue.lost}: {issue.label}{issue.detail ? ` (${issue.detail})` : ''}
                  </li>
                ))}
              </ul>
            )}
          </td>
        </tr>
      ) : null}
    </Fragment>
  );
}

export function SeoTab() {
  const [summary, setSummary] = useState<SeoSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [type, setType] = useState('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('seoScore');
  const [openUrl, setOpenUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setSummary(await seoAppApi.getSeoSummary());
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load the SEO dashboard.');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!summary?.running) return undefined;
    const timer = setInterval(() => { void load(); }, POLL_MS);
    return () => clearInterval(timer);
  }, [summary?.running, load]);

  const runAudit = async () => {
    setStarting(true);
    try {
      const result = await seoAppApi.startSeoAudit();
      if (!result.started && result.reason) setError(result.reason);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not start the audit.');
    } finally {
      setStarting(false);
    }
  };

  const pages = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (summary?.pages ?? [])
      .filter((page) => (type === 'all' || page.pageType === type) && (!needle || page.url.toLowerCase().includes(needle) || (page.title ?? '').toLowerCase().includes(needle)))
      .sort((a, b) => (sort === 'url' ? a.url.localeCompare(b.url) : a[sort] - b[sort]));
  }, [summary, type, search, sort]);

  const run = summary?.latestRun ?? null;
  const busy = starting || summary?.running === true;

  return (
    <AppPageLayout className="[overflow-anchor:none]">
      <WorkflowPageHeader eyebrow="Business" title="SEO & AI Search" />
      <DashboardSectionPanel id="seo-overview" title="Overview">
        <div className="flex flex-wrap items-center gap-3 text-[0.8rem] text-[var(--muted)]">
          <button type="button" className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-2 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] disabled:opacity-60" disabled={busy} onClick={() => { void runAudit(); }}>
            {busy ? 'Audit running…' : 'Run audit now'}
          </button>
          <span>{run?.finishedAt ? `Last audit ${dateTime.format(new Date(run.finishedAt))}${run.status === 'partial' ? ' (partial)' : ''}` : 'No audit has finished yet. Audits also run weekly.'}</span>
        </div>
        {error ? <p role="alert" className="m-0 text-sm text-red-500">{error}</p> : null}
        {run ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <StatTile label="Average SEO score" value={run.avgSeoScore ?? '–'} />
            <StatTile label="Average AI search score" value={run.avgAioScore ?? '–'} />
            <StatTile label="Pages audited" value={run.pageCount} />
          </div>
        ) : null}
        <p className="m-0 text-[0.75rem] text-[var(--muted)]">
          Scores are 0-100 from our own checklist of on-page SEO and AI-search readiness (structured data, answer-ready content, crawler access). Search rankings and clicks need Google Search Console and are not included yet.
        </p>
      </DashboardSectionPanel>

      {run ? (
        <DashboardSectionPanel id="seo-insights" title="Insights">
          <div className="grid gap-4 lg:grid-cols-2">
            <DashboardSubPanel title="Site checks">
              <ul className="m-0 list-none space-y-1.5 p-0 text-[0.85rem]">
                {run.siteChecks.map((check) => (
                  <li key={check.id}>
                    <span className={check.pass ? 'text-emerald-500' : 'text-red-500'}>{check.pass ? '✓' : '✕'}</span> {check.label}{check.detail ? <span className="text-[var(--muted)]"> ({check.detail})</span> : null}
                  </li>
                ))}
              </ul>
            </DashboardSubPanel>
            <DashboardSubPanel title="Biggest opportunities">
              <ul className="m-0 list-none space-y-1.5 p-0 text-[0.85rem]">
                {summary?.topIssues.map((issue) => (
                  <li key={`${issue.kind}-${issue.id}`}><span className="font-semibold uppercase">{issue.kind}</span> {issue.label} <span className="text-[var(--muted)]">· {issue.pages} pages</span></li>
                ))}
              </ul>
            </DashboardSubPanel>
            <DashboardSubPanel title="By page type">
              <table className="w-full text-left text-[0.82rem]">
                <thead><tr className="text-[0.68rem] uppercase tracking-[0.08em] text-[var(--muted)]"><th className="py-1 pr-3">Type</th><th className="py-1 pr-3">Pages</th><th className="py-1 pr-3">SEO</th><th className="py-1 pr-3">AI</th></tr></thead>
                <tbody>
                  {summary?.byType.map((row) => (
                    <tr key={row.pageType} className="border-t border-[var(--line)]"><td className="py-1.5 pr-3 capitalize">{row.pageType}</td><td className="py-1.5 pr-3">{row.pages}</td><td className="py-1.5 pr-3"><Score value={row.avgSeoScore} /></td><td className="py-1.5 pr-3"><Score value={row.avgAioScore} /></td></tr>
                  ))}
                </tbody>
              </table>
            </DashboardSubPanel>
            <DashboardSubPanel title="Trend (recent audits)">
              <table className="w-full text-left text-[0.82rem]">
                <thead><tr className="text-[0.68rem] uppercase tracking-[0.08em] text-[var(--muted)]"><th className="py-1 pr-3">Date</th><th className="py-1 pr-3">SEO</th><th className="py-1 pr-3">AI</th><th className="py-1 pr-3">Pages</th></tr></thead>
                <tbody>
                  {[...(summary?.trend ?? [])].reverse().map((point) => (
                    <tr key={point.finishedAt} className="border-t border-[var(--line)]"><td className="py-1.5 pr-3">{dateTime.format(new Date(point.finishedAt))}</td><td className="py-1.5 pr-3"><Score value={point.avgSeoScore} /></td><td className="py-1.5 pr-3"><Score value={point.avgAioScore} /></td><td className="py-1.5 pr-3">{point.pageCount}</td></tr>
                  ))}
                </tbody>
              </table>
            </DashboardSubPanel>
          </div>
        </DashboardSectionPanel>
      ) : null}

      {run ? (
        <DashboardSectionPanel id="seo-pages" title="Pages">
          <div className="flex flex-wrap items-center gap-2">
            <input className={`${tabFormControlBaseClass} !w-64`} placeholder="Filter by URL or title" aria-label="Filter pages" value={search} onChange={(event) => setSearch(event.target.value)} />
            <select className={`${tabFormControlBaseClass} !w-auto`} aria-label="Page type" value={type} onChange={(event) => setType(event.target.value)}>
              <option value="all">All types</option>
              {summary?.byType.map((row) => <option key={row.pageType} value={row.pageType}>{row.pageType}</option>)}
            </select>
            <select className={`${tabFormControlBaseClass} !w-auto`} aria-label="Sort pages" value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
              <option value="seoScore">Lowest SEO first</option>
              <option value="aioScore">Lowest AI first</option>
              <option value="url">URL</option>
            </select>
            <span className="text-[0.8rem] text-[var(--muted)]">{pages.length} shown{summary?.pagesTruncated ? ' (showing the 500 lowest-scoring pages)' : ''}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[0.82rem] text-[var(--ink)]">
              <thead><tr className="text-[0.68rem] uppercase tracking-[0.08em] text-[var(--muted)]"><th className="py-1 pr-3">Page</th><th className="py-1 pr-3">Type</th><th className="py-1 pr-3">SEO</th><th className="py-1 pr-3">AI</th><th className="py-1 pr-3">Issues</th><th className="py-1 pr-3" /></tr></thead>
              <tbody>
                {pages.slice(0, 200).map((page) => (
                  <PageRow key={page.url} page={page} open={openUrl === page.url} onToggle={() => setOpenUrl(openUrl === page.url ? null : page.url)} />
                ))}
              </tbody>
            </table>
          </div>
        </DashboardSectionPanel>
      ) : null}
    </AppPageLayout>
  );
}

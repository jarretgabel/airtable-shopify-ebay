import { LoadingSurface } from '@/components/app/StateSurfaces';
import { useEffect, useMemo, useState } from 'react';
import { AppPageLayout } from '@/components/app/AppPageLayout';
import { WorkflowPageHeader } from '@/components/app/WorkflowPageHeader';
import { DashboardSectionPanel, StatTile } from '@/components/dashboard/dashboardPrimitives';
import { assistantInsightsAppApi } from '@/services/app-api';
import type { AssistantInsights } from '@/services/app-api/assistantInsights';

const number = new Intl.NumberFormat('en-US');
const money = (value: number) => `$${value.toFixed(value < 1 ? 3 : 2)}`;

export function AssistantInsightsTab() {
  const [insights, setInsights] = useState<AssistantInsights | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState('all');
  const roles = useMemo(() => [...new Set((insights?.questions ?? []).map((q) => q.role ?? 'unknown'))].sort(), [insights]);
  const questions = (insights?.questions ?? []).filter((q) => roleFilter === 'all' || (q.role ?? 'unknown') === roleFilter);

  useEffect(() => {
    assistantInsightsAppApi.getAssistantInsights().then(setInsights).catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : 'Could not load assistant usage.');
    });
  }, []);

  return (
    <AppPageLayout>
      <WorkflowPageHeader eyebrow="Utilities" title="AI Assistant Audit" detail="Who uses the chatbot and what they ask it." />
      {error ? <p role="alert" className="m-0 text-sm text-red-500">{error}</p> : null}
      {insights ? (
        <>
          <DashboardSectionPanel id="assistant-usage" title={`Usage, last ${insights.days} days`}>
            <div className="grid gap-3 sm:grid-cols-3">
              <StatTile label="Questions asked" value={number.format(insights.totals.requests)} />
              <StatTile label="Tokens used" value={number.format(insights.totals.inputTokens + insights.totals.outputTokens)} />
              <StatTile label="Estimated cost" value={money(insights.totals.estimatedCostUsd)} />
            </div>
            <p className="m-0 text-[0.75rem] text-[var(--muted)]">
              Cost is an estimate from token counts at list prices; the Anthropic console has the exact bill. Tokens are only counted for requests since usage tracking was added.
            </p>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[0.82rem]">
                  <thead><tr className="text-[0.68rem] uppercase tracking-[0.08em] text-[var(--muted)]"><th className="py-1 pr-3">Day</th><th className="py-1 pr-3">Questions</th><th className="py-1 pr-3">Tokens</th><th className="py-1 pr-3">Est. cost</th></tr></thead>
                  <tbody>
                    {[...insights.daily].reverse().map((row) => (
                      <tr key={row.day} className="border-t border-[var(--line)]"><td className="py-1.5 pr-3">{row.day}</td><td className="py-1.5 pr-3">{row.requests}</td><td className="py-1.5 pr-3">{number.format(row.inputTokens + row.outputTokens)}</td><td className="py-1.5 pr-3">{money(row.estimatedCostUsd)}</td></tr>
                    ))}
                    {insights.daily.length === 0 ? <tr><td colSpan={4} className="py-2 text-[var(--muted)]">No usage yet.</td></tr> : null}
                  </tbody>
                </table>
              </div>
              <div className="space-y-4">
                <table className="w-full text-left text-[0.82rem]">
                  <thead><tr className="text-[0.68rem] uppercase tracking-[0.08em] text-[var(--muted)]"><th className="py-1 pr-3">Role</th><th className="py-1 pr-3">Questions</th><th className="py-1 pr-3">Tokens</th><th className="py-1 pr-3">Est. cost</th></tr></thead>
                  <tbody>
                    {insights.byRole.map((row) => (
                      <tr key={row.role} className="border-t border-[var(--line)]"><td className="py-1.5 pr-3 capitalize">{row.role}</td><td className="py-1.5 pr-3">{row.requests}</td><td className="py-1.5 pr-3">{number.format(row.tokens)}</td><td className="py-1.5 pr-3">{money(row.estimatedCostUsd)}</td></tr>
                    ))}
                  </tbody>
                </table>
                <table className="w-full text-left text-[0.82rem]">
                  <thead><tr className="text-[0.68rem] uppercase tracking-[0.08em] text-[var(--muted)]"><th className="py-1 pr-3">Heaviest users</th><th className="py-1 pr-3">Role</th><th className="py-1 pr-3">Questions</th><th className="py-1 pr-3">Tokens</th></tr></thead>
                  <tbody>
                    {insights.topUsers.map((row) => (
                      <tr key={row.userId} className="border-t border-[var(--line)]"><td className="max-w-[12rem] truncate py-1.5 pr-3" title={row.userId}>{row.userId}</td><td className="py-1.5 pr-3 capitalize">{row.role}</td><td className="py-1.5 pr-3">{row.requests}</td><td className="py-1.5 pr-3">{number.format(row.tokens)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </DashboardSectionPanel>
          <DashboardSectionPanel id="assistant-questions" title="Recent questions">
            <div className="flex flex-wrap items-center gap-3 text-[0.8rem] text-[var(--muted)]">
              <label className="flex items-center gap-2">Role
                <select className="rounded-lg border border-[var(--line)] bg-[var(--bg)] px-2 py-1 text-[var(--ink)]" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
                  <option value="all">All</option>
                  {roles.map((role) => <option key={role} value={role}>{role}</option>)}
                </select>
              </label>
              <span>Latest {questions.length} questions, kept 90 days. Only questions asked since logging was added appear.</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[0.82rem]">
                <thead><tr className="text-[0.68rem] uppercase tracking-[0.08em] text-[var(--muted)]"><th className="py-1 pr-3">When</th><th className="py-1 pr-3">Role</th><th className="py-1 pr-3">Question</th><th className="py-1 pr-3">Looked up</th></tr></thead>
                <tbody>
                  {questions.map((row) => (
                    <tr key={row.id} className="border-t border-[var(--line)] align-top">
                      <td className="whitespace-nowrap py-1.5 pr-3 text-[var(--muted)]">{new Date(row.at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</td>
                      <td className="py-1.5 pr-3 capitalize">{row.role ?? 'unknown'}</td>
                      <td className="py-1.5 pr-3">{row.question}{row.failed ? <span className="ml-2 text-red-500">failed</span> : null}</td>
                      <td className="py-1.5 pr-3 text-[var(--muted)]">{row.tools.length ? row.tools.join(', ') : '–'}</td>
                    </tr>
                  ))}
                  {questions.length === 0 ? <tr><td colSpan={4} className="py-2 text-[var(--muted)]">No questions logged yet.</td></tr> : null}
                </tbody>
              </table>
            </div>
          </DashboardSectionPanel>
        </>
      ) : error ? null : <LoadingSurface message="Loading assistant audit..." />}
    </AppPageLayout>
  );
}
